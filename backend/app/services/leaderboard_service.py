"""
Leaderboard and Progress Calculation Service.
Ensures that ONLY published final grades affect official rankings and progress stats.
"""
from typing import List, Dict, Any, Optional
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.models.user import User, UserStatus
from app.models.assignment import Assignment, AssignmentStatus, ThinkSpaceDirection
from app.models.submission import Submission, SubmissionStatus
from app.models.evaluation import PublishedGrade
from app.schemas.leaderboard import LeaderboardEntryResponse, MemberProgressResponse, DirectionPerformanceResponse

ALL_DIRECTIONS = [
    ThinkSpaceDirection.READ.value,
    ThinkSpaceDirection.DISCUSS.value,
    ThinkSpaceDirection.ANALYZE.value,
    ThinkSpaceDirection.LEAD.value,
    ThinkSpaceDirection.CREATE.value,
    ThinkSpaceDirection.CONNECT.value,
]

def calculate_leaderboard(
    session: Session,
    limit: int = 50
) -> List[LeaderboardEntryResponse]:
    stmt = (
        select(
            User.id.label("user_id"),
            User.display_name,
            User.student_id,
            User.faculty,
            func.coalesce(func.sum(PublishedGrade.final_score), 0.0).label("total_score"),
            func.coalesce(func.avg(PublishedGrade.percentage), 0.0).label("avg_percentage"),
            func.count(PublishedGrade.id).label("completed_count")
        )
        .outerjoin(PublishedGrade, User.id == PublishedGrade.user_id)
        .where(User.status == UserStatus.APPROVED.value)
        .group_by(User.id)
        .order_by(
            func.coalesce(func.sum(PublishedGrade.final_score), 0.0).desc(),
            func.coalesce(func.avg(PublishedGrade.percentage), 0.0).desc()
        )
        .limit(limit)
    )
    result = session.execute(stmt)
    rows = result.all()

    entries = []
    for rank, row in enumerate(rows, start=1):
        entries.append(LeaderboardEntryResponse(
            rank=rank,
            user_id=row.user_id,
            display_name=row.display_name,
            student_id=row.student_id,
            faculty=row.faculty,
            total_score=round(float(row.total_score), 2),
            average_percentage=round(float(row.avg_percentage), 2),
            completed_assignments=int(row.completed_count)
        ))
    return entries

def calculate_member_progress(
    session: Session,
    user_id: int
) -> MemberProgressResponse:
    total_assign_stmt = select(func.count(Assignment.id)).where(
        Assignment.status.in_([AssignmentStatus.OPEN.value, AssignmentStatus.CLOSED.value])
    )
    total_assign_res = session.execute(total_assign_stmt)
    total_assignments = total_assign_res.scalar() or 0

    grades_stmt = (
        select(PublishedGrade, Assignment.direction)
        .join(Assignment, PublishedGrade.assignment_id == Assignment.id)
        .where(PublishedGrade.user_id == user_id)
    )
    grades_res = session.execute(grades_stmt)
    grades_rows = grades_res.all()

    total_points = sum(r[0].final_score for r in grades_rows)
    graded_count = len(grades_rows)
    avg_percentage = (sum(r[0].percentage for r in grades_rows) / graded_count) if graded_count > 0 else 0.0
    completion_rate = (graded_count / total_assignments * 100.0) if total_assignments > 0 else 0.0

    pending_stmt = select(func.count(Submission.id)).where(
        Submission.user_id == user_id,
        Submission.status.in_([
            SubmissionStatus.SUBMITTED.value,
            SubmissionStatus.UNDER_REVIEW.value,
            SubmissionStatus.AWAITING_MODERATOR.value,
            SubmissionStatus.RESUBMITTED.value
        ])
    )
    pending_res = session.execute(pending_stmt)
    pending_count = pending_res.scalar() or 0

    dir_stats: Dict[str, Dict[str, Any]] = {
        d: {"count": 0, "total": 0.0, "percentages": []} for d in ALL_DIRECTIONS
    }
    for grade, direction in grades_rows:
        if direction in dir_stats:
            dir_stats[direction]["count"] += 1
            dir_stats[direction]["total"] += grade.final_score
            dir_stats[direction]["percentages"].append(grade.percentage)

    direction_responses = []
    for d in ALL_DIRECTIONS:
        st = dir_stats[d]
        avg_pct = (sum(st["percentages"]) / len(st["percentages"])) if st["percentages"] else 0.0
        direction_responses.append(DirectionPerformanceResponse(
            direction=d,
            assignments_completed=st["count"],
            total_score=round(st["total"], 2),
            average_percentage=round(avg_pct, 2)
        ))

    return MemberProgressResponse(
        user_id=user_id,
        total_points=round(total_points, 2),
        average_percentage=round(avg_percentage, 2),
        graded_assignments_count=graded_count,
        pending_reviews_count=pending_count,
        completion_rate=round(completion_rate, 2),
        directions=direction_responses
    )
