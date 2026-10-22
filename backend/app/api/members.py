"""
Member management, application review, and role assignment endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.deps import get_current_user, require_roles
from app.models.user import User, MembershipRequest, RoleEnum, UserStatus
from app.models.audit import AuditLog
from app.schemas.user import (
    MembershipRequestCreate,
    MembershipRequestReview,
    MembershipRequestResponse,
    UserResponse,
    RoleAssignRequest,
    UserUpdate,
)
from app.services.user_service import (
    submit_membership_request,
    review_membership_request,
    assign_role_to_user,
    revoke_role_from_user,
    get_user_by_id,
)

router = APIRouter(prefix="/members", tags=["Members & Membership"])

@router.post("/request", response_model=MembershipRequestResponse)
def apply_for_membership(
    payload: MembershipRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = submit_membership_request(
        session=db,
        user=current_user,
        statement=payload.statement,
        chosen_directions=payload.chosen_directions,
        student_id=payload.student_id,
        faculty=payload.faculty,
        phone=payload.phone
    )
    db.commit()
    db.refresh(req)
    return MembershipRequestResponse.model_validate(req)

@router.get("/requests", response_model=List[MembershipRequestResponse])
def list_membership_requests(
    status_filter: Optional[str] = "pending",
    current_user: User = Depends(require_roles([RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    stmt = select(MembershipRequest)
    if status_filter:
        stmt = stmt.where(MembershipRequest.status == status_filter)
    stmt = stmt.order_by(MembershipRequest.created_at.desc())
    result = db.execute(stmt)
    reqs = result.scalars().all()
    return [MembershipRequestResponse.model_validate(r) for r in reqs]

@router.post("/requests/{request_id}/review", response_model=MembershipRequestResponse)
def review_application(
    request_id: int,
    payload: MembershipRequestReview,
    current_user: User = Depends(require_roles([RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    req = review_membership_request(
        session=db,
        request_id=request_id,
        action=payload.action,
        reviewer_id=current_user.id,
        comment=payload.review_comment
    )
    if not req:
        raise HTTPException(status_code=404, detail="Ariza topilmadi")
    db.commit()
    db.refresh(req)
    return MembershipRequestResponse.model_validate(req)

@router.get("", response_model=List[UserResponse])
def list_all_members(
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_roles([RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    stmt = select(User)
    if status_filter:
        stmt = stmt.where(User.status == status_filter)
    stmt = stmt.order_by(User.created_at.desc())
    result = db.execute(stmt)
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]

@router.post("/{user_id}/roles", response_model=UserResponse)
def assign_user_role(
    user_id: int,
    payload: RoleAssignRequest,
    current_user: User = Depends(require_roles([RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O'z rolingizni o'zgartira olmaysiz (Cannot modify your own role)"
        )

    valid_roles = [r.value for r in RoleEnum]
    if payload.role_name not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Noto'g'ri rol. Ruxsat etilgan rollar: {', '.join(valid_roles)}"
        )

    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    assign_role_to_user(db, user_id, payload.role_name, granted_by_id=current_user.id)

    # When a role is assigned by Super Admin, automatically approve the user if they were pending
    if user.status == UserStatus.PENDING.value:
        user.status = UserStatus.APPROVED.value

    # Ensure user also has the base member role
    if payload.role_name != RoleEnum.MEMBER.value and not user.has_role(RoleEnum.MEMBER.value):
        assign_role_to_user(db, user_id, RoleEnum.MEMBER.value, granted_by_id=current_user.id)

    audit = AuditLog(
        user_id=current_user.id,
        action="role_assigned",
        entity_type="user_role",
        entity_id=str(user_id),
        details={"role_name": payload.role_name, "target_user_id": user_id}
    )
    db.add(audit)

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@router.post("/{user_id}/approve", response_model=UserResponse)
def approve_member_directly(
    user_id: int,
    current_user: User = Depends(require_roles([RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    user.status = UserStatus.APPROVED.value
    assign_role_to_user(db, user_id, RoleEnum.MEMBER.value, granted_by_id=current_user.id)

    audit = AuditLog(
        user_id=current_user.id,
        action="user_approved_directly",
        entity_type="user",
        entity_id=str(user_id),
        details={"target_user_id": user_id, "approved_by": current_user.display_name}
    )
    db.add(audit)

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)

@router.delete("/{user_id}/roles/{role_name}", response_model=UserResponse)
def remove_user_role(
    user_id: int,
    role_name: str,
    current_user: User = Depends(require_roles([RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O'z rolingizni o'zgartira olmaysiz (Cannot modify your own role)"
        )

    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    revoke_role_from_user(db, user_id, role_name)

    audit = AuditLog(
        user_id=current_user.id,
        action="role_revoked",
        entity_type="user_role",
        entity_id=str(user_id),
        details={"role_name": role_name, "target_user_id": user_id}
    )
    db.add(audit)

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)

@router.patch("/me", response_model=UserResponse)
def update_my_profile(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if payload.display_name:
        current_user.display_name = payload.display_name
    if payload.student_id:
        current_user.student_id = payload.student_id
    if payload.faculty:
        current_user.faculty = payload.faculty
    if payload.phone:
        current_user.phone = payload.phone
    if payload.preferred_language:
        current_user.preferred_language = payload.preferred_language

    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)
