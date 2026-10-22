"""
Pydantic schemas for Point Transactions and Manual Adjustments.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import Field
from app.schemas.compat import CompatBaseModel

class PointTransactionResponse(CompatBaseModel):
    id: int
    user_id: int
    assignment_id: Optional[int] = None
    assignment_title: Optional[str] = None
    transaction_type: str
    points: float
    reason: str
    source_entity_type: str
    source_entity_id: Optional[str] = None
    created_at: datetime

class ManualPointAdjustmentRequest(CompatBaseModel):
    user_id: int
    points: float = Field(..., description="Points to award or deduct")
    reason: str = Field(..., min_length=5, max_length=500, description="Mandatory audit explanation")

class PersonalRankingResponse(CompatBaseModel):
    current_rank: Optional[int] = None
    total_points: float = 0.0
    total_ranked_members: int = 0
    completed_assignments: int = 0
    average_percentage: float = 0.0
    direction_ranks: Optional[dict] = {}
