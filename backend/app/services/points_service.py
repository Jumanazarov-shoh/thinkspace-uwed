"""
Centralized Points Engine and Ledger Service for ThinkSpace | UWED.
Rules:
- Base assignment points = 100.0
- Performance points = (final_score / max_score) * Base points
- Completion bonus = 10.0 (awarded once per completed assignment)
- On-time bonus = 5.0 (awarded only if submission is not late)
- Late submissions receive performance + completion bonus, but 0 on-time bonus
- Idempotent: repeated runs never duplicate transactions
- Score corrections record explicit delta adjustments
"""
from datetime import datetime, timezone
import logging
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.models.user import User, UserStatus
from app.models.assignment import Assignment
from app.models.submission import Submission
from app.models.evaluation import PublishedGrade
from app.models.points import PointTransaction, PointTransactionType
from app.models.audit import AuditLog
from app.schemas.points import PointTransactionResponse

logger = logging.getLogger("thinkspace.points")

# Configuration constants (centralized and configurable)
BASE_ASSIGNMENT_POINTS: float = 100.0
COMPLETION_BONUS: float = 10.0
ON_TIME_BONUS: float = 5.0
LATE_GETS_COMPLETION_BONUS: bool = True

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def award_assignment_points(
    session: Session,
    submission: Submission,
    assignment: Assignment,
    published_grade: PublishedGrade
) -> List[PointTransaction]:
    """
    Idempotently calculates and records point transactions for a finalized assignment.
    Awards:
      1. Performance points based on final score
      2. Completion bonus (+10 pts)
      3. On-time bonus (+5 pts) if submitted before deadline
    """
    user_id = submission.user_id
    assignment_id = assignment.id
    max_score = max(float(assignment.max_score), 1.0)
    final_score = float(published_grade.final_score)
    created_transactions: List[PointTransaction] = []

    # 1. Performance Points
    perf_pts = round((final_score / max_score) * BASE_ASSIGNMENT_POINTS, 2)
    existing_perf = session.execute(
        select(PointTransaction).where(
            PointTransaction.user_id == user_id,
            PointTransaction.assignment_id == assignment_id,
            PointTransaction.transaction_type == PointTransactionType.ASSIGNMENT_PERFORMANCE.value
        )
    ).scalar_one_or_none()

    if not existing_perf:
        tx_perf = PointTransaction(
            user_id=user_id,
            assignment_id=assignment_id,
            transaction_type=PointTransactionType.ASSIGNMENT_PERFORMANCE.value,
            points=perf_pts,
            reason=f"Topshiriq natijasi: {final_score}/{assignment.max_score} ball ({assignment.title})",
            source_entity_type="published_grade",
            source_entity_id=str(published_grade.id),
            created_at=utc_now()
        )
        session.add(tx_perf)
        created_transactions.append(tx_perf)

    # 2. Completion Bonus
    existing_comp = session.execute(
        select(PointTransaction).where(
            PointTransaction.user_id == user_id,
            PointTransaction.assignment_id == assignment_id,
            PointTransaction.transaction_type == PointTransactionType.ASSIGNMENT_COMPLETION.value
        )
    ).scalar_one_or_none()

    if not existing_comp:
        tx_comp = PointTransaction(
            user_id=user_id,
            assignment_id=assignment_id,
            transaction_type=PointTransactionType.ASSIGNMENT_COMPLETION.value,
            points=COMPLETION_BONUS,
            reason=f"Topshiriqni yakunlash bonusi ({assignment.title})",
            source_entity_type="published_grade",
            source_entity_id=str(published_grade.id),
            created_at=utc_now()
        )
        session.add(tx_comp)
        created_transactions.append(tx_comp)

    # 3. On-time Bonus (only if not late)
    if not submission.is_late:
        existing_ontime = session.execute(
            select(PointTransaction).where(
                PointTransaction.user_id == user_id,
                PointTransaction.assignment_id == assignment_id,
                PointTransaction.transaction_type == PointTransactionType.ON_TIME_BONUS.value
            )
        ).scalar_one_or_none()

        if not existing_ontime:
            tx_ontime = PointTransaction(
                user_id=user_id,
                assignment_id=assignment_id,
                transaction_type=PointTransactionType.ON_TIME_BONUS.value,
                points=ON_TIME_BONUS,
                reason=f"Muddatida (o'z vaqtida) topshirish bonusi ({assignment.title})",
                source_entity_type="published_grade",
                source_entity_id=str(published_grade.id),
                created_at=utc_now()
            )
            session.add(tx_ontime)
            created_transactions.append(tx_ontime)

    session.flush()
    return created_transactions

def record_score_correction(
    session: Session,
    published_grade: PublishedGrade,
    previous_score: float,
    new_score: float,
    reason: str,
    changed_by_id: int
) -> Optional[PointTransaction]:
    """
    Controlled replacement/differential strategy for score adjustments:
    Records an auditable differential transaction (score_correction) representing
    (new_performance_points - old_performance_points).
    """
    assignment = published_grade.assignment
    if not assignment:
        return None

    max_score = max(float(assignment.max_score), 1.0)
    old_perf = round((previous_score / max_score) * BASE_ASSIGNMENT_POINTS, 2)
    new_perf = round((new_score / max_score) * BASE_ASSIGNMENT_POINTS, 2)
    delta = round(new_perf - old_perf, 2)

    if delta == 0.0:
        return None

    tx_corr = PointTransaction(
        user_id=published_grade.user_id,
        assignment_id=assignment.id,
        transaction_type=PointTransactionType.SCORE_CORRECTION.value,
        points=delta,
        reason=f"Baho o'zgarishi sababli tuzatish ({previous_score} -> {new_score}): {reason}",
        source_entity_type="grade_revision",
        source_entity_id=str(published_grade.id),
        created_by_id=changed_by_id,
        created_at=utc_now()
    )
    session.add(tx_corr)

    session.add(AuditLog(
        user_id=changed_by_id,
        action="point_score_correction",
        entity_type="point_transaction",
        entity_id=str(published_grade.id),
        details={
            "user_id": published_grade.user_id,
            "assignment_id": assignment.id,
            "delta_points": delta,
            "reason": reason
        }
    ))

    session.flush()
    return tx_corr

def award_manual_adjustment(
    session: Session,
    admin_id: int,
    user_id: int,
    points: float,
    reason: str
) -> PointTransaction:
    """
    Super Admin manual adjustment (+10, -5, etc.) with mandatory audit logging.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    if not reason or len(reason.strip()) < 5:
        raise HTTPException(status_code=400, detail="Ballni o'zgartirish uchun asos (sabab) kamida 5 ta belgidan iborat bo'lishi shart.")

    tx = PointTransaction(
        user_id=user_id,
        assignment_id=None,
        transaction_type=PointTransactionType.MANUAL_ADJUSTMENT.value,
        points=round(points, 2),
        reason=reason.strip(),
        source_entity_type="admin_adjustment",
        source_entity_id=None,
        created_by_id=admin_id,
        created_at=utc_now()
    )
    session.add(tx)

    session.add(AuditLog(
        user_id=admin_id,
        action="manual_point_adjustment",
        entity_type="point_transaction",
        entity_id=str(user_id),
        details={"target_user_id": user_id, "points": points, "reason": reason}
    ))

    session.flush()
    return tx

def get_member_points_history(
    session: Session,
    user_id: int,
    limit: int = 50
) -> List[PointTransactionResponse]:
    """
    Returns the personal points ledger for a member.
    """
    stmt = (
        select(PointTransaction)
        .where(PointTransaction.user_id == user_id)
        .order_by(PointTransaction.created_at.desc())
        .limit(limit)
    )
    transactions = session.execute(stmt).scalars().all()

    items = []
    for tx in transactions:
        ass_title = tx.assignment.title if tx.assignment else None
        items.append(PointTransactionResponse(
            id=tx.id,
            user_id=tx.user_id,
            assignment_id=tx.assignment_id,
            assignment_title=ass_title,
            transaction_type=tx.transaction_type,
            points=round(tx.points, 2),
            reason=tx.reason,
            source_entity_type=tx.source_entity_type,
            source_entity_id=tx.source_entity_id,
            created_at=tx.created_at
        ))
    return items

def backfill_existing_published_grades(session: Session) -> int:
    """
    One-time backfill helper: ensures any existing PublishedGrade records
    in database are converted into point ledger entries.
    """
    grades = session.execute(select(PublishedGrade)).scalars().all()
    count = 0
    for g in grades:
        sub = g.submission
        ass = g.assignment
        if sub and ass:
            txs = award_assignment_points(session, sub, ass, g)
            count += len(txs)
    session.commit()
    return count
