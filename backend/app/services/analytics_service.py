"""
Admin Analytics Dashboard Service for ThinkSpace | UWED.
Calculates high-trust operational metrics, direction distributions, and member performance tables.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session

from app.models.user import User, UserStatus
from app.models.assignment import Assignment, AssignmentStatus, ThinkSpaceDirection
from app.models.submission import Submission, SubmissionStatus
from app.models.evaluation import PublishedGrade, Evaluation, EvaluationStatus, ReviewStatus
from app.models.points import PointTransaction
from app.schemas.analytics import (
    AdminAnalyticsOverviewResponse,
    DirectionAnalyticsItem,
    AdminMemberPerformanceItem,
    AdminMemberDetailResponse,
)
from app.schemas.points import PointTransactionResponse
from app.schemas.leaderboard import DirectionPerformanceResponse

ALL_DIRECTIONS = [
    ThinkSpaceDirection.READ.value,
    ThinkSpaceDirection.DISCUSS.value,
    ThinkSpaceDirection.ANALYZE.value,
    ThinkSpaceDirection.LEAD.value,
    ThinkSpaceDirection.CREATE.value,
    ThinkSpaceDirection.CONNECT.value,
]

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def get_analytics_overview(
    session: Session,
    date_range: str = "all_time"
) -> AdminAnalyticsOverviewResponse:
    now = utc_now()
    since_date = None
    if date_range == "last_30_days":
        since_date = now - timedelta(days=30)

    # 1. Members metrics
    approved_members = session.execute(
        select(User).where(User.status == UserStatus.APPROVED.value)
    ).scalars().all()
    total_members = len(approved_members)
    member_ids = [m.id for m in approved_members]

    # Active members (activity within date range or has any submission)
    if since_date:
        active_users_stmt = select(func.count(func.distinct(Submission.user_id))).where(
            Submission.user_id.in_(member_ids),
            Submission.created_at >= since_date
        )
        active_members = session.execute(active_users_stmt).scalar() or 0
    else:
        active_users_stmt = select(func.count(func.distinct(Submission.user_id))).where(
            Submission.user_id.in_(member_ids)
        )
        active_members = session.execute(active_users_stmt).scalar() or 0

    # Members with at least one formal submission
    formal_sub_members_stmt = select(func.count(func.distinct(Submission.user_id))).where(
        Submission.user_id.in_(member_ids),
        Submission.status != SubmissionStatus.DRAFT.value
    )
    members_with_subs = session.execute(formal_sub_members_stmt).scalar() or 0

    # Members with at least one finalized evaluation
    finalized_members_stmt = select(func.count(func.distinct(PublishedGrade.user_id))).where(
        PublishedGrade.user_id.in_(member_ids)
    )
    members_with_evals = session.execute(finalized_members_stmt).scalar() or 0

    active_member_rate = round((active_members / max(total_members, 1)) * 100.0, 1)

    # 2. Assignment metrics
    all_assign_stmt = select(Assignment)
    if since_date:
        all_assign_stmt = all_assign_stmt.where(Assignment.created_at >= since_date)
    assignments = session.execute(all_assign_stmt).scalars().all()
    total_assignments = len(assignments)

    published_assignments = sum(
        1 for a in assignments if a.status in [AssignmentStatus.PUBLISHED.value, AssignmentStatus.OPEN.value]
    )
    closed_assignments = sum(
        1 for a in assignments if a.status in [AssignmentStatus.CLOSED.value, AssignmentStatus.ARCHIVED.value]
    )

    # 3. Submission metrics
    sub_query = select(Submission)
    if since_date:
        sub_query = sub_query.where(Submission.created_at >= since_date)
    all_submissions = session.execute(sub_query).scalars().all()
    total_submissions = len(all_submissions)

    formal_submissions = [s for s in all_submissions if s.status != SubmissionStatus.DRAFT.value]
    draft_count = sum(1 for s in all_submissions if s.status == SubmissionStatus.DRAFT.value)
    late_count = sum(1 for s in formal_submissions if s.is_late)
    on_time_count = sum(1 for s in formal_submissions if not s.is_late)
    on_time_rate = round((on_time_count / max(len(formal_submissions), 1)) * 100.0, 1)

    # Submission rate (formal submissions / total possible)
    potential_slots = max(published_assignments * total_members, 1)
    submission_rate = round((len(formal_submissions) / potential_slots) * 100.0, 1)

    # 4. Evaluation metrics
    pending_evals_stmt = select(func.count(Submission.id)).where(
        Submission.status.in_([SubmissionStatus.SUBMITTED.value, SubmissionStatus.UNDER_REVIEW.value])
    )
    evaluations_pending = session.execute(pending_evals_stmt).scalar() or 0

    needs_review_stmt = select(func.count(Submission.id)).where(
        Submission.review_status.in_([
            ReviewStatus.NEEDS_REVIEW.value,
            ReviewStatus.SENIOR_REVIEW.value,
            ReviewStatus.MODERATOR_REVIEW.value
        ])
    )
    needs_review_count = session.execute(needs_review_stmt).scalar() or 0

    grade_query = select(PublishedGrade)
    if since_date:
        grade_query = grade_query.where(PublishedGrade.published_at >= since_date)
    all_grades = session.execute(grade_query).scalars().all()
    evaluations_finalized = len(all_grades)

    avg_score = 0.0
    if all_grades:
        avg_score = round(sum(g.percentage for g in all_grades) / len(all_grades), 1)

    # Engagement: Completion rate
    completion_rate = round((evaluations_finalized / potential_slots) * 100.0, 1)

    return AdminAnalyticsOverviewResponse(
        total_members=total_members,
        active_members=active_members,
        members_with_submissions=members_with_subs,
        members_with_finalized_evaluations=members_with_evals,
        active_member_rate=active_member_rate,
        total_assignments=total_assignments,
        published_assignments=published_assignments,
        closed_assignments=closed_assignments,
        submission_rate=submission_rate,
        total_submissions=total_submissions,
        on_time_count=on_time_count,
        late_count=late_count,
        draft_count=draft_count,
        on_time_rate=on_time_rate,
        evaluations_pending=evaluations_pending,
        evaluations_finalized=evaluations_finalized,
        needs_review_count=needs_review_count,
        average_finalized_score=avg_score,
        completion_rate=completion_rate
    )

def get_direction_analytics(session: Session) -> List[DirectionAnalyticsItem]:
    total_members = session.execute(
        select(func.count(User.id)).where(User.status == UserStatus.APPROVED.value)
    ).scalar() or 1

    items: List[DirectionAnalyticsItem] = []

    for d in ALL_DIRECTIONS:
        # Assignments count
        assigns = session.execute(
            select(Assignment).where(
                Assignment.direction == d,
                Assignment.status.in_([
                    AssignmentStatus.PUBLISHED.value,
                    AssignmentStatus.OPEN.value,
                    AssignmentStatus.CLOSED.value
                ])
            )
        ).scalars().all()
        assign_ids = [a.id for a in assigns]
        assignments_count = len(assigns)

        if not assign_ids:
            items.append(DirectionAnalyticsItem(
                direction=d,
                assignments_count=0,
                submissions_count=0,
                completion_rate=0.0,
                average_finalized_score=0.0,
                total_points_awarded=0.0
            ))
            continue

        # Submissions count
        subs_count = session.execute(
            select(func.count(Submission.id)).where(
                Submission.assignment_id.in_(assign_ids),
                Submission.status != SubmissionStatus.DRAFT.value
            )
        ).scalar() or 0

        # Finalized grades
        grades = session.execute(
            select(PublishedGrade).where(PublishedGrade.assignment_id.in_(assign_ids))
        ).scalars().all()
        finalized_count = len(grades)

        avg_score = 0.0
        if grades:
            avg_score = round(sum(g.percentage for g in grades) / len(grades), 1)

        # Total points awarded for this direction
        total_points = session.execute(
            select(func.coalesce(func.sum(PointTransaction.points), 0.0)).where(
                PointTransaction.assignment_id.in_(assign_ids)
            )
        ).scalar() or 0.0

        potential = max(assignments_count * total_members, 1)
        completion_rate = round((finalized_count / potential) * 100.0, 1)

        items.append(DirectionAnalyticsItem(
            direction=d,
            assignments_count=assignments_count,
            submissions_count=subs_count,
            completion_rate=completion_rate,
            average_finalized_score=avg_score,
            total_points_awarded=round(float(total_points), 2)
        ))

    return items

def get_admin_members_table(
    session: Session,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    order: str = "desc"
) -> List[AdminMemberPerformanceItem]:
    from app.services.leaderboard_service import calculate_leaderboard

    # Use overall leaderboard calculation to get official competition ranks and points
    lb = calculate_leaderboard(session, limit=1000)
    lb_map = {item.user_id: item for item in lb}

    members = session.execute(
        select(User).where(User.status == UserStatus.APPROVED.value)
    ).scalars().all()

    total_published_assignments = session.execute(
        select(func.count(Assignment.id)).where(
            Assignment.status.in_([AssignmentStatus.PUBLISHED.value, AssignmentStatus.OPEN.value, AssignmentStatus.CLOSED.value])
        )
    ).scalar() or 1

    items = []
    for m in members:
        # Check search filter
        if search:
            q = search.lower()
            name_match = q in (m.display_name or "").lower()
            id_match = m.student_id and q in m.student_id.lower()
            if not (name_match or id_match):
                continue

        # Get submissions
        subs = session.execute(
            select(Submission).where(Submission.user_id == m.id)
        ).scalars().all()
        formal_subs = [s for s in subs if s.status != SubmissionStatus.DRAFT.value]
        late_count = sum(1 for s in formal_subs if s.is_late)

        # Leaderboard stats
        lb_entry = lb_map.get(m.id)
        total_points = lb_entry.total_points if lb_entry else 0.0
        rank = lb_entry.rank if lb_entry else None
        completed_count = lb_entry.completed_assignments if lb_entry else 0
        avg_score = lb_entry.average_percentage if lb_entry else 0.0

        completion_rate = round((completed_count / max(total_published_assignments, 1)) * 100.0, 1)

        # Last activity
        last_sub_date = max((s.submitted_at for s in formal_subs if s.submitted_at), default=None)
        last_act = m.last_activity_at or last_sub_date or m.updated_at

        items.append(AdminMemberPerformanceItem(
            user_id=m.id,
            display_name=m.display_name or f"Member #{m.id}",
            student_id=m.student_id,
            faculty=m.faculty,
            total_points=round(total_points, 2),
            rank=rank,
            assignments_submitted=len(formal_subs),
            assignments_completed=completed_count,
            completion_rate=completion_rate,
            average_score=avg_score,
            late_submissions=late_count,
            last_activity=last_act
        ))

    # Sorting
    reverse = (order.lower() == "desc")
    if sort_by == "points":
        items.sort(key=lambda x: x.total_points, reverse=reverse)
    elif sort_by == "rank":
        items.sort(key=lambda x: (x.rank is None, x.rank or 999999), reverse=not reverse)
    elif sort_by == "name":
        items.sort(key=lambda x: x.display_name.lower(), reverse=reverse)
    elif sort_by == "completion":
        items.sort(key=lambda x: x.completion_rate, reverse=reverse)
    elif sort_by == "score":
        items.sort(key=lambda x: x.average_score, reverse=reverse)
    else:
        # Default: by total points desc
        items.sort(key=lambda x: x.total_points, reverse=True)

    return items

def get_member_detail_analytics(session: Session, user_id: int) -> AdminMemberDetailResponse:
    from app.services.leaderboard_service import calculate_member_progress
    from app.services.points_service import get_member_points_history

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    # Member progress breakdown
    progress = calculate_member_progress(session, user_id)

    # Member table entry
    table_items = get_admin_members_table(session)
    member_perf = next((item for item in table_items if item.user_id == user_id), None)
    if not member_perf:
        member_perf = AdminMemberPerformanceItem(
            user_id=user.id,
            display_name=user.display_name,
            student_id=user.student_id,
            faculty=user.faculty,
            total_points=progress.total_points,
            rank=None,
            assignments_submitted=progress.assignments_submitted_count,
            assignments_completed=progress.graded_assignments_count,
            completion_rate=progress.completion_rate,
            average_score=progress.average_score,
            late_submissions=progress.late_submissions_count,
            last_activity=user.last_activity_at
        )

    # Points history
    points_history = get_member_points_history(session, user_id, limit=100)

    # Submissions history
    subs = session.execute(
        select(Submission).where(Submission.user_id == user_id).order_by(Submission.created_at.desc())
    ).scalars().all()

    sub_list = []
    for s in subs:
        ass = s.assignment
        grade = s.published_grade
        sub_list.append({
            "id": s.id,
            "assignment_id": s.assignment_id,
            "assignment_title": ass.title if ass else f"Assignment #{s.assignment_id}",
            "direction": ass.direction if ass else "Other",
            "status": s.status,
            "review_status": s.review_status,
            "is_late": s.is_late,
            "version_number": s.latest_version.version_number if s.latest_version else 1,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            "final_score": grade.final_score if grade else None,
            "max_score": grade.max_score if grade else (ass.max_score if ass else 100.0),
            "percentage": grade.percentage if grade else None
        })

    roles_list = [r.role_name for r in user.roles]

    return AdminMemberDetailResponse(
        user_id=user.id,
        display_name=user.display_name,
        student_id=user.student_id,
        faculty=user.faculty,
        status=user.status,
        roles=roles_list,
        total_points=member_perf.total_points,
        rank=member_perf.rank,
        performance=member_perf,
        points_history=points_history,
        direction_breakdown=progress.directions,
        submissions=sub_list
    )
