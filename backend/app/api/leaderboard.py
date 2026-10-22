"""
Leaderboard, Ranking, and Member Points Ledger API routes.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.leaderboard import LeaderboardEntryResponse, MemberProgressResponse
from app.schemas.points import PointTransactionResponse, PersonalRankingResponse
from app.services.leaderboard_service import (
    calculate_leaderboard,
    calculate_personal_ranking,
    calculate_member_progress,
)
from app.services.points_service import get_member_points_history

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard & Progress"])

@router.get("", response_model=List[LeaderboardEntryResponse])
def get_official_leaderboard(
    direction: Optional[str] = Query(None, description="Optional direction filter"),
    limit: int = 50,
    db: Session = Depends(get_db)
):
    return calculate_leaderboard(db, direction=direction, limit=limit)

@router.get("/me/rank", response_model=PersonalRankingResponse)
def get_my_ranking(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return calculate_personal_ranking(db, current_user.id)

@router.get("/me/points", response_model=List[PointTransactionResponse])
def get_my_points_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_member_points_history(db, current_user.id, limit=limit)

@router.get("/my-progress", response_model=MemberProgressResponse)
def get_my_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return calculate_member_progress(db, current_user.id)

@router.get("/member/{user_id}/progress", response_model=MemberProgressResponse)
def get_member_progress(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return calculate_member_progress(db, user_id)
