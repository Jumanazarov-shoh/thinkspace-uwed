"""
Assignment API routes for ThinkSpace | UWED.
Provides full CRUD, lifecycle actions, role-based visibility, and audit logging.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.assignment import AssignmentStatus
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentUpdate,
    AssignmentResponse,
    RubricCriterionCreate,
    RubricCriterionUpdate,
    RubricCriterionResponse,
    RubricResponse,
)
from app.services.assignment_service import (
    create_assignment,
    get_assignment_by_id,
    list_assignments,
    update_assignment,
    publish_assignment,
    close_assignment,
    archive_assignment,
    revert_to_draft,
    delete_assignment,
    get_assignment_rubric,
    add_rubric_criterion,
    update_rubric_criterion,
    delete_rubric_criterion,
)

router = APIRouter(prefix="/assignments", tags=["Assignments"])

STAFF_ROLES = [
    RoleEnum.EVALUATOR.value,
    RoleEnum.SENIOR_REVIEWER.value,
    RoleEnum.MODERATOR.value,
    RoleEnum.SUPER_ADMIN.value
]

MANAGEMENT_ROLES = [
    RoleEnum.EVALUATOR.value,
    RoleEnum.MODERATOR.value,
    RoleEnum.SUPER_ADMIN.value
]

PUBLISH_ROLES = [
    RoleEnum.MODERATOR.value,
    RoleEnum.SUPER_ADMIN.value,
    RoleEnum.EVALUATOR.value
]

@router.get("", response_model=List[AssignmentResponse])
def get_assignments(
    direction: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    is_staff = any(current_user.has_role(r) for r in STAFF_ROLES)
    items = list_assignments(
        db,
        direction=direction,
        status=status,
        search=search,
        is_admin_or_evaluator=is_staff
    )

    # Map user's personal submission status for each assignment
    sub_map = {}
    if current_user and current_user.id:
        from app.models.submission import Submission
        subs = db.execute(
            select(Submission.assignment_id, Submission.status).where(
                Submission.user_id == current_user.id
            )
        ).all()
        sub_map = {row[0]: row[1] for row in subs}

    results = []
    for a in items:
        resp = AssignmentResponse.model_validate(a)
        resp.my_submission_status = sub_map.get(a.id, "not_started")
        results.append(resp)
    return results

@router.get("/{assignment_id}", response_model=AssignmentResponse)
def get_assignment(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assignment = get_assignment_by_id(db, assignment_id)
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topshiriq topilmadi (Assignment not found)"
        )

    is_staff = any(current_user.has_role(r) for r in STAFF_ROLES)
    if assignment.status in [AssignmentStatus.DRAFT.value, AssignmentStatus.ARCHIVED.value]:
        if not is_staff:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Ushbu topshiriq faqat administratorlar uchun ko'rinadi (Assignment is restricted)"
            )

    resp = AssignmentResponse.model_validate(assignment)
    if current_user and current_user.id:
        from app.models.submission import Submission
        sub = db.execute(
            select(Submission.status).where(
                Submission.assignment_id == assignment_id,
                Submission.user_id == current_user.id
            )
        ).scalar_one_or_none()
        resp.my_submission_status = sub or "not_started"
    return resp

@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_new_assignment(
    payload: AssignmentCreate,
    request: Request,
    current_user: User = Depends(require_roles(MANAGEMENT_ROLES)),
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else None
    assignment = create_assignment(
        db,
        payload,
        creator_id=current_user.id,
        ip_address=client_ip
    )
    db.commit()
    db.refresh(assignment)
    return AssignmentResponse.model_validate(assignment)

@router.put("/{assignment_id}", response_model=AssignmentResponse)
@router.patch("/{assignment_id}", response_model=AssignmentResponse)
def update_existing_assignment(
    assignment_id: int,
    payload: AssignmentUpdate,
    request: Request,
    current_user: User = Depends(require_roles(MANAGEMENT_ROLES)),
    db: Session = Depends(get_db)
):
    assignment = get_assignment_by_id(db, assignment_id)
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topshiriq topilmadi (Assignment not found)"
        )

    # Permission check: Evaluators can only edit their own assignments unless Super Admin / Moderator
    is_super_or_mod = current_user.has_role(RoleEnum.SUPER_ADMIN.value) or current_user.has_role(RoleEnum.MODERATOR.value)
    if not is_super_or_mod and assignment.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Faqat o'zingiz yaratgan topshiriqni tahrirlashingiz mumkin"
        )

    client_ip = request.client.host if request.client else None
    updated = update_assignment(
        db,
        assignment_id,
        payload,
        actor_id=current_user.id,
        ip_address=client_ip
    )
    db.commit()
    db.refresh(updated)
    return AssignmentResponse.model_validate(updated)

@router.post("/{assignment_id}/publish", response_model=AssignmentResponse)
def publish_existing_assignment(
    assignment_id: int,
    request: Request,
    current_user: User = Depends(require_roles(PUBLISH_ROLES)),
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else None
    assignment = publish_assignment(db, assignment_id, actor_id=current_user.id, ip_address=client_ip)
    if not assignment:
        raise HTTPException(status_code=404, detail="Topshiriq topilmadi")
    db.commit()
    db.refresh(assignment)
    return AssignmentResponse.model_validate(assignment)

@router.post("/{assignment_id}/close", response_model=AssignmentResponse)
def close_existing_assignment(
    assignment_id: int,
    request: Request,
    current_user: User = Depends(require_roles([RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else None
    assignment = close_assignment(db, assignment_id, actor_id=current_user.id, ip_address=client_ip)
    if not assignment:
        raise HTTPException(status_code=404, detail="Topshiriq topilmadi")
    db.commit()
    db.refresh(assignment)
    return AssignmentResponse.model_validate(assignment)

@router.post("/{assignment_id}/archive", response_model=AssignmentResponse)
def archive_existing_assignment(
    assignment_id: int,
    request: Request,
    current_user: User = Depends(require_roles([RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else None
    assignment = archive_assignment(db, assignment_id, actor_id=current_user.id, ip_address=client_ip)
    if not assignment:
        raise HTTPException(status_code=404, detail="Topshiriq topilmadi")
    db.commit()
    db.refresh(assignment)
    return AssignmentResponse.model_validate(assignment)

@router.post("/{assignment_id}/draft", response_model=AssignmentResponse)
def revert_existing_assignment_to_draft(
    assignment_id: int,
    request: Request,
    current_user: User = Depends(require_roles([RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else None
    assignment = revert_to_draft(db, assignment_id, actor_id=current_user.id, ip_address=client_ip)
    if not assignment:
        raise HTTPException(status_code=404, detail="Topshiriq topilmadi")
    db.commit()
    db.refresh(assignment)
    return AssignmentResponse.model_validate(assignment)

@router.delete("/{assignment_id}")
def delete_existing_assignment(
    assignment_id: int,
    request: Request,
    current_user: User = Depends(require_roles([RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else None
    try:
        success = delete_assignment(db, assignment_id, actor_id=current_user.id, ip_address=client_ip)
        if not success:
            raise HTTPException(status_code=404, detail="Topshiriq topilmadi")
        db.commit()
        return {"success": True, "message": "Topshiriq muvaffaqiyatli o'chirildi"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{assignment_id}/rubric", response_model=RubricResponse)
def get_rubric_for_assignment(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rubric = get_assignment_rubric(db, assignment_id)
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubrika topilmadi")
    return RubricResponse.model_validate(rubric)

@router.post("/{assignment_id}/rubric/criteria", response_model=RubricCriterionResponse)
def create_rubric_criterion_endpoint(
    assignment_id: int,
    payload: RubricCriterionCreate,
    current_user: User = Depends(require_roles([RoleEnum.EVALUATOR.value, RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    crit = add_rubric_criterion(db, assignment_id, payload, actor_id=current_user.id)
    db.commit()
    db.refresh(crit)
    return RubricCriterionResponse.model_validate(crit)

@router.put("/{assignment_id}/rubric/criteria/{criterion_id}", response_model=RubricCriterionResponse)
def update_rubric_criterion_endpoint(
    assignment_id: int,
    criterion_id: int,
    payload: RubricCriterionUpdate,
    current_user: User = Depends(require_roles([RoleEnum.EVALUATOR.value, RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    crit = update_rubric_criterion(db, assignment_id, criterion_id, payload, actor_id=current_user.id)
    db.commit()
    db.refresh(crit)
    return RubricCriterionResponse.model_validate(crit)

@router.delete("/{assignment_id}/rubric/criteria/{criterion_id}")
def delete_rubric_criterion_endpoint(
    assignment_id: int,
    criterion_id: int,
    current_user: User = Depends(require_roles([RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    delete_rubric_criterion(db, assignment_id, criterion_id, actor_id=current_user.id)
    db.commit()
    return {"success": True, "message": "Mezon muvaffaqiyatli o'chirildi"}
