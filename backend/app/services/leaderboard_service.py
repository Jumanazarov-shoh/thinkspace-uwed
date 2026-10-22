"""
Leaderboard and Progress Calculation Service.
Ensures that ONLY published final grades affect official rankings and progress stats.
"""
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session
from app.models.user import User, UserStatus
from app.models.assignment import Assignment, AssignmentStatus, ThinkSpaceDirection
from app.models.submission import Submission, SubmissionStatus
from app.models.evaluation import PublishedGrade, ReviewStatus
from app.models.notification import Notification, NotificationType
from app.models.points import PointTransaction
from app.schemas.leaderboard import (
    LeaderboardEntryResponse,
    MemberProgressResponse,
    DirectionPerformanceResponse,
    RecentResultItem,
    RecentActivityItem,
)
from app.schemas.points import PersonalRankingResponse

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
    direction: Optional[str] = None,
    limit: int = 50
) -> List[LeaderboardEntryResponse]:
    # 1. Fetch all approved members
    members = session.execute(
        select(User).where(User.status == UserStatus.APPROVED.value)
    ).scalars().all()

    # 2. For each member, compute: total_points, avg_percentage, completed_count
    records = []
    for m in members:
        # Check point transactions
        pt_query = select(func.coalesce(func.sum(PointTransaction.points), 0.0)).where(PointTransaction.user_id == m.id)
        if direction:
            pt_query = pt_query.join(Assignment, PointTransaction.assignment_id == Assignment.id).where(Assignment.direction == direction)
        total_pts = float(session.execute(pt_query).scalar() or 0.0)

        # Published grades
        pg_query = select(PublishedGrade).where(PublishedGrade.user_id == m.id)
        if direction:
            pg_query = pg_query.join(Assignment, PublishedGrade.assignment_id == Assignment.id).where(Assignment.direction == direction)
        user_grades = session.execute(pg_query).scalars().all()

        completed_count = len(user_grades)
        avg_pct = round(sum(g.percentage for g in user_grades) / completed_count, 2) if completed_count > 0 else 0.0

        # Fallback if points engine hasn't recorded transactions for legacy tests:
        if total_pts == 0.0 and completed_count > 0:
            total_pts = round(sum(g.final_score for g in user_grades), 2)

        records.append({
            "user_id": m.id,
            "display_name": m.display_name or f"Member #{m.id}",
            "student_id": m.student_id,
            "faculty": m.faculty,
            "total_points": round(total_pts, 2),
            "avg_percentage": avg_pct,
            "completed_count": completed_count
        })

    # 3. Deterministic Sort:
    # 1. total_points desc
    # 2. avg_percentage desc
    # 3. completed_count desc
    # 4. user_id asc (tie-breaker)
    records.sort(key=lambda x: (-x["total_points"], -x["avg_percentage"], -x["completed_count"], x["user_id"]))

    # 4. Competition Ranking (1, 2, 2, 4)
    entries: List[LeaderboardEntryResponse] = []
    for i, r in enumerate(records[:limit]):
        if i == 0:
            rank = 1
        else:
            prev = records[i - 1]
            if (r["total_points"] == prev["total_points"] and
                r["avg_percentage"] == prev["avg_percentage"] and
                r["completed_count"] == prev["completed_count"]):
                rank = entries[i - 1].rank
            else:
                rank = i + 1

        entries.append(LeaderboardEntryResponse(
            rank=rank,
            user_id=r["user_id"],
            display_name=r["display_name"],
            student_id=r["student_id"],
            faculty=r["faculty"],
            total_points=r["total_points"],
            total_score=r["total_points"],
            average_percentage=r["avg_percentage"],
            completed_assignments=r["completed_count"]
        ))
    return entries

def calculate_personal_ranking(
    session: Session,
    user_id: int
) -> PersonalRankingResponse:
    """
    Computes a member's personal ranking card, including overall rank and direction-specific ranks.
    """
    overall_lb = calculate_leaderboard(session, limit=1000)
    user_entry = next((e for e in overall_lb if e.user_id == user_id), None)
    total_ranked = len(overall_lb)

    direction_ranks = {}
    for d in ALL_DIRECTIONS:
        dir_lb = calculate_leaderboard(session, direction=d, limit=1000)
        dir_entry = next((e for e in dir_lb if e.user_id == user_id), None)
        direction_ranks[d] = dir_entry.rank if dir_entry and dir_entry.total_points > 0 else None

    if user_entry:
        return PersonalRankingResponse(
            current_rank=user_entry.rank if user_entry.total_points > 0 else None,
            total_points=user_entry.total_points,
            total_ranked_members=total_ranked,
            completed_assignments=user_entry.completed_assignments,
            average_percentage=user_entry.average_percentage,
            direction_ranks=direction_ranks
        )

    return PersonalRankingResponse(
        current_rank=None,
        total_points=0.0,
        total_ranked_members=total_ranked,
        completed_assignments=0,
        average_percentage=0.0,
        direction_ranks=direction_ranks
    )

def calculate_member_progress(
    session: Session,
    user_id: int
) -> MemberProgressResponse:
    # 1. Total published/active assignments
    active_assign_stmt = select(Assignment).where(
        Assignment.status.in_([
            AssignmentStatus.PUBLISHED.value,
            AssignmentStatus.OPEN.value,
            AssignmentStatus.CLOSED.value
        ])
    )
    active_assignments = list(session.execute(active_assign_stmt).scalars().all())
    total_assignments = len(active_assignments)

    # Available counts per direction
    dir_avail_map: Dict[str, int] = {d: 0 for d in ALL_DIRECTIONS}
    for a in active_assignments:
        d_val = a.direction
        if d_val in dir_avail_map:
            dir_avail_map[d_val] += 1

    # 2. Member Submissions
    sub_stmt = select(Submission).where(Submission.user_id == user_id)
    all_subs = list(session.execute(sub_stmt).scalars().all())

    draft_count = sum(1 for s in all_subs if s.status == SubmissionStatus.DRAFT.value)
    late_count = sum(1 for s in all_subs if s.is_late)
    formal_subs = [s for s in all_subs if s.status != SubmissionStatus.DRAFT.value]
    submitted_count = len(formal_subs)

    # 3. Finalized Grades
    grades_stmt = (
        select(PublishedGrade, Assignment)
        .join(Assignment, PublishedGrade.assignment_id == Assignment.id)
        .where(PublishedGrade.user_id == user_id)
        .order_by(PublishedGrade.published_at.desc())
    )
    grades_rows = session.execute(grades_stmt).all()

    # Check ledger points
    ledger_points_stmt = select(func.coalesce(func.sum(PointTransaction.points), 0.0)).where(
        PointTransaction.user_id == user_id
    )
    ledger_pts = float(session.execute(ledger_points_stmt).scalar() or 0.0)

    total_points = ledger_pts if ledger_pts > 0 else sum(r[0].final_score for r in grades_rows)
    graded_count = len(grades_rows)
    avg_score = round(sum(r[0].final_score for r in grades_rows) / graded_count, 2) if graded_count > 0 else 0.0
    avg_percentage = round(sum(r[0].percentage for r in grades_rows) / graded_count, 2) if graded_count > 0 else 0.0
    completion_rate = round((submitted_count / total_assignments * 100.0), 2) if total_assignments > 0 else 0.0

    # 4. Pending Reviews (submitted but not finalized)
    pending_count = sum(
        1 for s in formal_subs 
        if s.review_status != ReviewStatus.FINALIZED.value and s.status not in (SubmissionStatus.PUBLISHED.value, SubmissionStatus.APPROVED.value)
    )

    # 5. Direction performance stats
    dir_stats: Dict[str, Dict[str, Any]] = {
        d: {"count": 0, "total": 0.0, "percentages": []} for d in ALL_DIRECTIONS
    }
    for grade, assign in grades_rows:
        d = assign.direction
        if d in dir_stats:
            dir_stats[d]["count"] += 1
            dir_stats[d]["total"] += grade.final_score
            dir_stats[d]["percentages"].append(grade.percentage)

    direction_responses = []
    for d in ALL_DIRECTIONS:
        st = dir_stats[d]
        c = st["count"]
        tot = st["total"]
        avg_s = round(tot / c, 2) if c > 0 else 0.0
        avg_p = round(sum(st["percentages"]) / len(st["percentages"]), 2) if st["percentages"] else 0.0
        direction_responses.append(DirectionPerformanceResponse(
            direction=d,
            assignments_available=dir_avail_map.get(d, 0),
            assignments_completed=c,
            total_score=round(tot, 2),
            average_score=avg_s,
            average_percentage=avg_p
        ))

    # 6. Recent finalized results list
    recent_results = []
    for grade, assign in grades_rows[:10]:
        recent_results.append(RecentResultItem(
            assignment_id=assign.id,
            assignment_title=assign.title,
            direction=assign.direction,
            score=round(grade.final_score, 2),
            max_score=round(grade.max_score, 2),
            percentage=round(grade.percentage, 2),
            finalized_at=grade.published_at
        ))

    # 7. Recent activity timeline (real system events)
    recent_activity = []
    # Add finalized results
    for grade, assign in grades_rows[:5]:
        recent_activity.append(RecentActivityItem(
            type="evaluation_finalized",
            title=f"Baho tasdiqlandi: {assign.title}",
            description=f"Natijangiz: {grade.final_score}/{grade.max_score} ball ({grade.percentage}%)",
            timestamp=grade.published_at,
            related_id=str(assign.id)
        ))
    # Add submissions
    for s in formal_subs[:5]:
        if s.submitted_at:
            assign = s.assignment
            recent_activity.append(RecentActivityItem(
                type="submission",
                title=f"Topshiriq topshirildi: {assign.title if assign else 'Topshiriq'}",
                description="Kechikkan" if s.is_late else "O'z vaqtida topshirildi",
                timestamp=s.submitted_at,
                related_id=str(s.assignment_id)
            ))
    # Add announcements from notifications
    announcements = session.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.type == NotificationType.SYSTEM_ANNOUNCEMENT.value
        ).order_by(Notification.created_at.desc()).limit(3)
    ).scalars().all()
    for ann in announcements:
        recent_activity.append(RecentActivityItem(
            type="announcement",
            title=ann.title,
            description=ann.message[:120],
            timestamp=ann.created_at,
            related_id=ann.related_entity_id
        ))

    def get_activity_ts(item: RecentActivityItem) -> datetime:
        dt = item.timestamp
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

    recent_activity.sort(key=get_activity_ts, reverse=True)
    recent_activity = recent_activity[:10]

    return MemberProgressResponse(
        user_id=user_id,
        total_points=round(total_points, 2),
        average_score=avg_score,
        average_percentage=avg_percentage,
        total_assignments_available=total_assignments,
        assignments_submitted_count=submitted_count,
        graded_assignments_count=graded_count,
        finalized_evaluations_count=graded_count,
        pending_reviews_count=pending_count,
        draft_submissions_count=draft_count,
        late_submissions_count=late_count,
        completion_rate=completion_rate,
        directions=direction_responses,
        recent_results=recent_results,
        recent_activity=recent_activity
    )
