"""
Pydantic schemas for Leaderboard and Personal Progress.
"""
from typing import List, Optional
from app.schemas.compat import CompatBaseModel

class LeaderboardEntryResponse(CompatBaseModel):
    rank: int
    user_id: int
    display_name: str
    student_id: Optional[str] = None
    faculty: Optional[str] = None
    total_score: float
    average_percentage: float
    completed_assignments: int

class DirectionPerformanceResponse(CompatBaseModel):
    direction: str
    assignments_completed: int
    total_score: float
    average_percentage: float

class MemberProgressResponse(CompatBaseModel):
    user_id: int
    total_points: float
    average_percentage: float
    graded_assignments_count: int
    pending_reviews_count: int
    completion_rate: float
    directions: List[DirectionPerformanceResponse] = []
