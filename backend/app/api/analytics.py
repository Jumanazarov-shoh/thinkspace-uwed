"""
Admin Analytics Dashboard and Points Adjustment API routes.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import require_roles
from app.models.user import User, RoleEnum
from app.schemas.analytics import (
    AdminAnalyticsOverviewResponse,
    DirectionAnalyticsItem,
    AdminMemberPerformanceItem,
    AdminMemberDetailResponse,
)
from app.schemas.points import (
    PointTransactionResponse,
    ManualPointAdjustmentRequest,
)
from app.services.analytics_service import (
    get_analytics_overview,
    get_direction_analytics,
    get_admin_members_table,
    get_member_detail_analytics,
)
from app.services.points_service import award_manual_adjustment

router = APIRouter(prefix="/admin", tags=["Admin Analytics & Operations"])

@router.get("/analytics/overview", response_model=AdminAnalyticsOverviewResponse)
def get_analytics_overview_route(
    date_range: str = Query("all_time", pattern="^(all_time|last_30_days)$"),
    current_user: User = Depends(require_roles(["admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    return get_analytics_overview(db, date_range=date_range)

@router.get("/analytics/directions", response_model=List[DirectionAnalyticsItem])
def get_direction_analytics_route(
    current_user: User = Depends(require_roles(["admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    return get_direction_analytics(db)

@router.get("/analytics/members", response_model=List[AdminMemberPerformanceItem])
def get_admin_members_table_route(
    search: Optional[str] = Query(None, description="Search by member display name or student ID"),
    sort_by: Optional[str] = Query(None, description="Field to sort by: points, rank, name, completion, score"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(require_roles(["admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    return get_admin_members_table(db, search=search, sort_by=sort_by, order=order)

@router.get("/analytics/members/{user_id}", response_model=AdminMemberDetailResponse)
def get_member_detail_analytics_route(
    user_id: int,
    current_user: User = Depends(require_roles(["admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    return get_member_detail_analytics(db, user_id=user_id)

@router.post("/points/adjust", response_model=PointTransactionResponse)
def adjust_member_points_manually(
    req: ManualPointAdjustmentRequest,
    current_user: User = Depends(require_roles(["super_admin"])),
    db: Session = Depends(get_db)
):
    tx = award_manual_adjustment(
        session=db,
        admin_id=current_user.id,
        user_id=req.user_id,
        points=req.points,
        reason=req.reason
    )
    db.commit()
    db.refresh(tx)
    return PointTransactionResponse(
        id=tx.id,
        user_id=tx.user_id,
        assignment_id=tx.assignment_id,
        assignment_title=tx.assignment.title if tx.assignment else None,
        transaction_type=tx.transaction_type,
        points=tx.points,
        reason=tx.reason,
        source_entity_type=tx.source_entity_type,
        source_entity_id=tx.source_entity_id,
        created_at=tx.created_at
    )
