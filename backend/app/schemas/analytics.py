"""
Pydantic schemas for Admin Analytics Dashboard and Direction Metrics.
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from app.schemas.compat import CompatBaseModel
from app.schemas.points import PointTransactionResponse
from app.schemas.leaderboard import DirectionPerformanceResponse

class AdminAnalyticsOverviewResponse(CompatBaseModel):
    # Member metrics
    total_members: int = 0
    active_members: int = 0
    members_with_submissions: int = 0
    members_with_finalized_evaluations: int = 0
    active_member_rate: float = 0.0

    # Assignment metrics
    total_assignments: int = 0
    published_assignments: int = 0
    closed_assignments: int = 0
    submission_rate: float = 0.0

    # Submission metrics
    total_submissions: int = 0
    on_time_count: int = 0
    late_count: int = 0
    draft_count: int = 0
    on_time_rate: float = 0.0

    # Evaluation metrics
    evaluations_pending: int = 0
    evaluations_finalized: int = 0
    needs_review_count: int = 0
    average_finalized_score: float = 0.0

    # Engagement metrics
    completion_rate: float = 0.0

class DirectionAnalyticsItem(CompatBaseModel):
    direction: str
    assignments_count: int = 0
    submissions_count: int = 0
    completion_rate: float = 0.0
    average_finalized_score: float = 0.0
    total_points_awarded: float = 0.0

class AdminMemberPerformanceItem(CompatBaseModel):
    user_id: int
    display_name: str
    student_id: Optional[str] = None
    faculty: Optional[str] = None
    total_points: float = 0.0
    rank: Optional[int] = None
    assignments_submitted: int = 0
    assignments_completed: int = 0
    completion_rate: float = 0.0
    average_score: float = 0.0
    late_submissions: int = 0
    last_activity: Optional[datetime] = None

class AdminMemberDetailResponse(CompatBaseModel):
    user_id: int
    display_name: str
    student_id: Optional[str] = None
    faculty: Optional[str] = None
    status: str
    roles: List[str]
    total_points: float = 0.0
    rank: Optional[int] = None
    performance: AdminMemberPerformanceItem
    points_history: List[PointTransactionResponse] = []
    direction_breakdown: List[DirectionPerformanceResponse] = []
    submissions: List[Dict[str, Any]] = []
