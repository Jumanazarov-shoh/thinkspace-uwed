"""
Moderation, Grade Publishing, and Appeals API routes.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.evaluation import ReviewRequest
from app.schemas.evaluation import (
    ModeratorDecisionCreate,
    ModeratorDecisionResponse,
    PublishedGradeResponse,
    GradeRevisionCreate,
    GradeRevisionResponse,
    ReviewRequestCreate,
    ReviewRequestResolve,
    ReviewRequestResponse,
)
from app.services.moderation_service import (
    moderate_submission,
    publish_final_grade,
    revise_published_grade,
    submit_review_request,
    resolve_review_request,
)

router = APIRouter(prefix="/moderation", tags=["Moderation & Publishing"])

@router.post("/submissions/{submission_id}/decision", response_model=ModeratorDecisionResponse)
def record_moderation_decision(
    submission_id: int,
    payload: ModeratorDecisionCreate,
    current_user: User = Depends(require_roles([RoleEnum.MODERATOR.value, RoleEnum.SENIOR_REVIEWER.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    decision = moderate_submission(
        session=db,
        submission_id=submission_id,
        moderator_id=current_user.id,
        decision=payload.decision,
        rationale=payload.rationale,
        override_score=payload.override_score
    )
    db.commit()
    db.refresh(decision)
    return ModeratorDecisionResponse.model_validate(decision)

@router.post("/submissions/{submission_id}/publish-grade", response_model=PublishedGradeResponse)
def publish_submission_grade(
    submission_id: int,
    current_user: User = Depends(require_roles([RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    grade = publish_final_grade(db, submission_id, publisher_id=current_user.id)
    db.commit()
    db.refresh(grade)
    return PublishedGradeResponse.model_validate(grade)

@router.post("/published-grades/{grade_id}/revise", response_model=GradeRevisionResponse)
def revise_grade(
    grade_id: int,
    payload: GradeRevisionCreate,
    current_user: User = Depends(require_roles([RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    rev = revise_published_grade(
        session=db,
        published_grade_id=grade_id,
        new_score=payload.new_score,
        reason=payload.reason,
        changed_by_id=current_user.id
    )
    db.commit()
    db.refresh(rev)
    return GradeRevisionResponse.model_validate(rev)

@router.post("/published-grades/{grade_id}/appeal", response_model=ReviewRequestResponse)
def appeal_published_grade(
    grade_id: int,
    payload: ReviewRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = submit_review_request(
        session=db,
        published_grade_id=grade_id,
        user_id=current_user.id,
        reason=payload.reason
    )
    db.commit()
    db.refresh(req)
    return ReviewRequestResponse.model_validate(req)

@router.get("/appeals", response_model=List[ReviewRequestResponse])
def list_appeals(
    status_filter: Optional[str] = "pending",
    current_user: User = Depends(require_roles([RoleEnum.MODERATOR.value, RoleEnum.SENIOR_REVIEWER.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    stmt = select(ReviewRequest)
    if status_filter:
        stmt = stmt.where(ReviewRequest.status == status_filter)
    stmt = stmt.order_by(ReviewRequest.created_at.desc())
    result = db.execute(stmt)
    reqs = result.scalars().all()
    return [ReviewRequestResponse.model_validate(r) for r in reqs]

@router.post("/appeals/{appeal_id}/resolve", response_model=ReviewRequestResponse)
def resolve_appeal(
    appeal_id: int,
    payload: ReviewRequestResolve,
    current_user: User = Depends(require_roles([RoleEnum.MODERATOR.value, RoleEnum.SENIOR_REVIEWER.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    req = resolve_review_request(
        session=db,
        request_id=appeal_id,
        resolver_id=current_user.id,
        action=payload.action,
        resolution_comment=payload.resolution_comment,
        adjusted_score=payload.adjusted_score
    )
    db.commit()
    db.refresh(req)
    return ReviewRequestResponse.model_validate(req)
