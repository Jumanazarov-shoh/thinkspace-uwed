"""
User management, membership request handling, and super-admin bootstrapping.
"""
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import settings
from app.models.user import User, UserRole, MembershipRequest, UserStatus, RoleEnum
from app.models.audit import AuditLog

def get_user_by_telegram_id(session: Session, telegram_id: int) -> Optional[User]:
    stmt = select(User).where(User.telegram_id == telegram_id)
    result = session.execute(stmt)
    return result.scalar_one_or_none()

def get_user_by_id(session: Session, user_id: int) -> Optional[User]:
    stmt = select(User).where(User.id == user_id)
    result = session.execute(stmt)
    return result.scalar_one_or_none()

def get_or_create_user_from_telegram(
    session: Session,
    telegram_id: int,
    first_name: str,
    last_name: Optional[str] = None,
    username: Optional[str] = None,
    preferred_language: str = "uz"
) -> User:
    user = get_user_by_telegram_id(session, telegram_id)
    display_name = f"{first_name} {last_name}".strip() if last_name else first_name
    is_super_admin = (settings.SUPER_ADMIN_TELEGRAM_ID > 0 and telegram_id == settings.SUPER_ADMIN_TELEGRAM_ID)
    
    if not user:
        status = UserStatus.APPROVED.value if is_super_admin else UserStatus.PENDING.value
        user = User(
            telegram_id=telegram_id,
            username=username,
            first_name=first_name,
            last_name=last_name,
            display_name=display_name,
            status=status,
            preferred_language=preferred_language
        )
        session.add(user)
        session.flush()
        
        if is_super_admin:
            session.add(UserRole(user_id=user.id, role_name=RoleEnum.SUPER_ADMIN.value))
            session.add(UserRole(user_id=user.id, role_name=RoleEnum.MODERATOR.value))
            session.add(UserRole(user_id=user.id, role_name=RoleEnum.EVALUATOR.value))
            session.add(UserRole(user_id=user.id, role_name=RoleEnum.MEMBER.value))
            session.flush()
    else:
        user.first_name = first_name
        user.last_name = last_name
        user.username = username
        user.display_name = display_name
        if is_super_admin and not user.has_role(RoleEnum.SUPER_ADMIN.value):
            user.status = UserStatus.APPROVED.value
            session.add(UserRole(user_id=user.id, role_name=RoleEnum.SUPER_ADMIN.value))
            session.add(UserRole(user_id=user.id, role_name=RoleEnum.MODERATOR.value))
            session.add(UserRole(user_id=user.id, role_name=RoleEnum.EVALUATOR.value))
            session.add(UserRole(user_id=user.id, role_name=RoleEnum.MEMBER.value))
            session.flush()

    return user

def assign_role_to_user(
    session: Session,
    user_id: int,
    role_name: str,
    granted_by_id: Optional[int] = None
) -> UserRole:
    stmt = select(UserRole).where(UserRole.user_id == user_id, UserRole.role_name == role_name)
    result = session.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        return existing
        
    user_role = UserRole(user_id=user_id, role_name=role_name, granted_by_id=granted_by_id)
    session.add(user_role)
    session.flush()
    return user_role

def revoke_role_from_user(
    session: Session,
    user_id: int,
    role_name: str
) -> bool:
    stmt = select(UserRole).where(UserRole.user_id == user_id, UserRole.role_name == role_name)
    result = session.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        session.delete(existing)
        session.flush()
        return True
    return False

def submit_membership_request(
    session: Session,
    user: User,
    statement: str,
    chosen_directions: List[str],
    student_id: Optional[str] = None,
    faculty: Optional[str] = None,
    phone: Optional[str] = None
) -> MembershipRequest:
    if student_id:
        user.student_id = student_id
    if faculty:
        user.faculty = faculty
    if phone:
        user.phone = phone
        
    req = MembershipRequest(
        user_id=user.id,
        statement=statement,
        chosen_directions=chosen_directions,
        status=UserStatus.PENDING.value
    )
    session.add(req)
    session.flush()
    return req

def review_membership_request(
    session: Session,
    request_id: int,
    action: str,
    reviewer_id: int,
    comment: Optional[str] = None
) -> Optional[MembershipRequest]:
    stmt = select(MembershipRequest).where(MembershipRequest.id == request_id)
    result = session.execute(stmt)
    req = result.scalar_one_or_none()
    if not req:
        return None

    user = get_user_by_id(session, req.user_id)
    if not user:
        return None

    req.reviewed_by_id = reviewer_id
    req.reviewed_at = datetime.now(timezone.utc)
    req.review_comment = comment

    if action == "approve":
        req.status = UserStatus.APPROVED.value
        user.status = UserStatus.APPROVED.value
        assign_role_to_user(session, user.id, RoleEnum.MEMBER.value, granted_by_id=reviewer_id)
    else:
        req.status = UserStatus.REJECTED.value
        user.status = UserStatus.REJECTED.value

    audit = AuditLog(
        user_id=reviewer_id,
        action=f"membership_request_{action}",
        entity_type="membership_request",
        entity_id=str(request_id),
        details={"target_user_id": user.id, "comment": comment}
    )
    session.add(audit)
    session.flush()
    return req
