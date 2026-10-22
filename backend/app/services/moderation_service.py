"""
Moderation, Grade Publishing, Grade Revision, and Review Request (Appeal) Service.
Ensures published grades are immutable except through traceable audit revisions.
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.submission import Submission, SubmissionStatus
from app.models.evaluation import (
    Evaluation,
    EvaluationStatus,
    ModeratorDecision,
    ModeratorDecisionType,
    PublishedGrade,
    GradeRevision,
    ReviewRequest,
    ReviewRequestStatus
)
from app.models.audit import AuditLog

def moderate_submission(
    session: Session,
    submission_id: int,
    moderator_id: int,
    decision: str,
    rationale: str,
    override_score: Optional[float] = None
) -> ModeratorDecision:
    stmt = select(Submission).where(Submission.id == submission_id)
    result = session.execute(stmt)
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Topshirilgan ish topilmadi")

    if decision == ModeratorDecisionType.OVERRIDDEN.value and override_score is None:
        raise HTTPException(status_code=400, detail="Ballni o'zgartirish uchun yangi ball (override_score) ko'rsatilishi shart.")

    moderator_decision = ModeratorDecision(
        submission_id=submission.id,
        moderator_id=moderator_id,
        decision=decision,
        override_score=override_score,
        rationale=rationale
    )
    session.add(moderator_decision)

    if decision == ModeratorDecisionType.APPROVED.value or decision == ModeratorDecisionType.OVERRIDDEN.value:
        submission.status = SubmissionStatus.APPROVED.value
    elif decision == ModeratorDecisionType.RETURNED_TO_EVALUATOR.value:
        submission.status = SubmissionStatus.UNDER_REVIEW.value
    elif decision == ModeratorDecisionType.REJECTED.value:
        submission.status = SubmissionStatus.REJECTED.value

    session.add(AuditLog(
        user_id=moderator_id,
        action=f"moderator_{decision}",
        entity_type="submission",
        entity_id=str(submission_id),
        details={"rationale": rationale, "override_score": override_score}
    ))

    session.flush()
    return moderator_decision

def publish_final_grade(
    session: Session,
    submission_id: int,
    publisher_id: int
) -> PublishedGrade:
    stmt = select(Submission).where(Submission.id == submission_id)
    result = session.execute(stmt)
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Topshirilgan ish topilmadi")

    assignment = submission.assignment
    if not assignment:
        raise HTTPException(status_code=400, detail="Bog'langan topshiriq topilmadi")

    if submission.published_grade:
        return submission.published_grade

    override_decision = next(
        (d for d in reversed(submission.moderator_decisions) if d.decision == ModeratorDecisionType.OVERRIDDEN.value and d.override_score is not None),
        None
    )

    if override_decision:
        final_score = override_decision.override_score
        overall_feedback = f"Moderator xulosasi: {override_decision.rationale}"
    else:
        version_id = submission.current_version_id
        eval_stmt = select(Evaluation).where(
            Evaluation.submission_id == submission_id,
            Evaluation.status == EvaluationStatus.SUBMITTED.value
        )
        if version_id:
            eval_stmt = eval_stmt.where(Evaluation.submission_version_id == version_id)
        valid_evals = list(session.execute(eval_stmt).scalars().all())
        if not valid_evals:
            raise HTTPException(status_code=400, detail="Baholash yakunlanmagan. Hech bo'lmaganda bitta to'liq baho talab etiladi.")

        final_score = sum(e.total_score for e in valid_evals) / len(valid_evals)
        feedbacks = [f"• {e.general_feedback}" for e in valid_evals if e.general_feedback]
        overall_feedback = "\n".join(feedbacks)

    max_score = float(assignment.max_score)
    percentage = (final_score / max_score) * 100.0 if max_score > 0 else 0.0

    published_grade = PublishedGrade(
        submission_id=submission.id,
        assignment_id=assignment.id,
        user_id=submission.user_id,
        final_score=round(final_score, 2),
        max_score=max_score,
        percentage=round(percentage, 2),
        overall_feedback=overall_feedback,
        published_by_id=publisher_id,
        published_at=datetime.now(timezone.utc)
    )
    session.add(published_grade)
    submission.status = SubmissionStatus.PUBLISHED.value

    session.add(AuditLog(
        user_id=publisher_id,
        action="grade_published",
        entity_type="published_grade",
        entity_id=str(submission.id),
        details={"final_score": final_score, "percentage": percentage}
    ))

    session.flush()

    # Milestone 7: Award transparent points via Points Engine
    try:
        from app.services.points_service import award_assignment_points
        award_assignment_points(session, submission, assignment, published_grade)
    except Exception as e:
        import logging
        logging.getLogger("thinkspace.moderation").warning(f"Points award notice: {e}")

    return published_grade

def revise_published_grade(
    session: Session,
    published_grade_id: int,
    new_score: float,
    reason: str,
    changed_by_id: int
) -> GradeRevision:
    stmt = select(PublishedGrade).where(PublishedGrade.id == published_grade_id)
    result = session.execute(stmt)
    grade = result.scalar_one_or_none()
    if not grade:
        raise HTTPException(status_code=404, detail="E'lon qilingan baho topilmadi")

    if new_score < 0 or new_score > grade.max_score:
        raise HTTPException(status_code=400, detail=f"Baho 0 dan {grade.max_score} gacha bo'lishi shart.")

    previous_score = grade.final_score
    grade.final_score = new_score
    grade.percentage = round((new_score / grade.max_score) * 100.0, 2)

    revision = GradeRevision(
        published_grade_id=grade.id,
        previous_score=previous_score,
        new_score=new_score,
        reason=reason,
        changed_by_id=changed_by_id,
        changed_at=datetime.now(timezone.utc)
    )
    session.add(revision)

    session.add(AuditLog(
        user_id=changed_by_id,
        action="grade_revised",
        entity_type="published_grade",
        entity_id=str(grade.id),
        details={"previous_score": previous_score, "new_score": new_score, "reason": reason}
    ))

    session.flush()

    # Milestone 7: Adjust points ledger with auditable score correction
    try:
        from app.services.points_service import record_score_correction
        record_score_correction(session, grade, previous_score, new_score, reason, changed_by_id)
    except Exception as e:
        import logging
        logging.getLogger("thinkspace.moderation").warning(f"Points correction notice: {e}")

    return revision

def submit_review_request(
    session: Session,
    published_grade_id: int,
    user_id: int,
    reason: str
) -> ReviewRequest:
    stmt = select(PublishedGrade).where(PublishedGrade.id == published_grade_id)
    result = session.execute(stmt)
    grade = result.scalar_one_or_none()
    if not grade:
        raise HTTPException(status_code=404, detail="Baho topilmadi")

    if grade.user_id != user_id:
        raise HTTPException(status_code=403, detail="Faqat o'z bahoyingiz bo'yicha qayta ko'rib chiqish so'rashingiz mumkin.")

    existing_stmt = select(ReviewRequest).where(
        ReviewRequest.published_grade_id == published_grade_id,
        ReviewRequest.status == ReviewRequestStatus.PENDING.value
    )
    ex_res = session.execute(existing_stmt)
    if ex_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ushbu baho bo'yicha ko'rib chiqish so'rovi allaqachon yuborilgan.")

    req = ReviewRequest(
        published_grade_id=grade.id,
        user_id=user_id,
        reason=reason,
        status=ReviewRequestStatus.PENDING.value
    )
    session.add(req)
    session.flush()
    return req

def resolve_review_request(
    session: Session,
    request_id: int,
    resolver_id: int,
    action: str,
    resolution_comment: str,
    adjusted_score: Optional[float] = None
) -> ReviewRequest:
    stmt = select(ReviewRequest).where(ReviewRequest.id == request_id)
    result = session.execute(stmt)
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="So'rov topilmadi")

    req.resolver_id = resolver_id
    req.resolution_comment = resolution_comment
    req.resolved_at = datetime.now(timezone.utc)

    if action == "resolve":
        req.status = ReviewRequestStatus.RESOLVED.value
        if adjusted_score is not None:
            revise_published_grade(
                session=session,
                published_grade_id=req.published_grade_id,
                new_score=adjusted_score,
                reason=f"Qayta ko'rib chiqish natijasi: {resolution_comment}",
                changed_by_id=resolver_id
            )
    else:
        req.status = ReviewRequestStatus.REJECTED.value

    session.flush()
    return req
