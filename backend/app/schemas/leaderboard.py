"""
Pydantic schemas for Leaderboard and Personal Progress.
"""
from datetime import datetime
from typing import List, Optional
from app.schemas.compat import CompatBaseModel

class LeaderboardEntryResponse(CompatBaseModel):
    rank: int
    user_id: int
    display_name: str
    student_id: Optional[str] = None
    faculty: Optional[str] = None
    total_points: float = 0.0
    total_score: float = 0.0
    average_percentage: float = 0.0
    completed_assignments: int = 0

class DirectionPerformanceResponse(CompatBaseModel):
    direction: str
    assignments_available: int = 0
    assignments_completed: int = 0
    total_score: float = 0.0
    average_score: float = 0.0
    average_percentage: float = 0.0

class RecentResultItem(CompatBaseModel):
    assignment_id: int
    assignment_title: str
    direction: str
    score: float
    max_score: float
    percentage: float
    finalized_at: Optional[datetime] = None

class RecentActivityItem(CompatBaseModel):
    type: str # "submission", "evaluation_finalized", "assignment_published", "announcement"
    title: str
    description: str
    timestamp: datetime
    related_id: Optional[str] = None

class MemberProgressResponse(CompatBaseModel):
    user_id: int
    total_points: float = 0.0
    average_score: float = 0.0
    average_percentage: float = 0.0
    total_assignments_available: int = 0
    assignments_submitted_count: int = 0
    graded_assignments_count: int = 0
    finalized_evaluations_count: int = 0
    pending_reviews_count: int = 0
    draft_submissions_count: int = 0
    late_submissions_count: int = 0
    completion_rate: float = 0.0
    directions: List[DirectionPerformanceResponse] = []
    recent_results: List[RecentResultItem] = []
    recent_activity: List[RecentActivityItem] = []
