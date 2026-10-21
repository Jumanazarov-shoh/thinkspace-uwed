"""
Assignment API routes.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentUpdate,
    AssignmentResponse,
)
from app.services.assignment_service import (
    create_assignment,
    get_assignment_by_id,
    list_assignments,
    update_assignment,
)

router = APIRouter(prefix="/assignments", tags=["Assignments"])

@router.get("", response_model=List[AssignmentResponse])
def get_assignments(
    direction: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    is_staff = (
        current_user.has_role(RoleEnum.EVALUATOR.value) or
        current_user.has_role(RoleEnum.MODERATOR.value) or
        current_user.has_role(RoleEnum.SUPER_ADMIN.value)
    )
    items = list_assignments(db, direction=direction, status=status, is_admin_or_evaluator=is_staff)
    return [AssignmentResponse.model_validate(a) for a in items]

@router.get("/{assignment_id}", response_model=AssignmentResponse)
def get_assignment(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assignment = get_assignment_by_id(db, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Topshiriq topilmadi")

    if assignment.status in ["draft", "scheduled"]:
        is_staff = (
            current_user.has_role(RoleEnum.EVALUATOR.value) or
            current_user.has_role(RoleEnum.MODERATOR.value) or
            current_user.has_role(RoleEnum.SUPER_ADMIN.value)
        )
        if not is_staff:
            raise HTTPException(status_code=403, detail="Topshiriq hali e'lon qilinmagan")

    return AssignmentResponse.model_validate(assignment)

@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_new_assignment(
    payload: AssignmentCreate,
    current_user: User = Depends(require_roles([RoleEnum.EVALUATOR.value, RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    assignment = create_assignment(db, payload, creator_id=current_user.id)
    db.commit()
    db.refresh(assignment)
    return AssignmentResponse.model_validate(assignment)

@router.patch("/{assignment_id}", response_model=AssignmentResponse)
def update_existing_assignment(
    assignment_id: int,
    payload: AssignmentUpdate,
    current_user: User = Depends(require_roles([RoleEnum.EVALUATOR.value, RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    assignment = update_assignment(db, assignment_id, payload)
    if not assignment:
        raise HTTPException(status_code=404, detail="Topshiriq topilmadi")
    db.commit()
    db.refresh(assignment)
    return AssignmentResponse.model_validate(assignment)
