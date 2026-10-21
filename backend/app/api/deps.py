"""
FastAPI dependency injection utilities for authentication, database sessions, and role-based access control.
"""
from typing import Callable, List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserStatus, RoleEnum
from app.services.auth_service import decode_access_token
from app.services.user_service import get_user_by_id

security = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autentifikatsiya talab etiladi (Authentication required)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token yaroqsiz yoki muddati o'tgan (Invalid or expired token)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ma'lumotlari noto'g'ri (Invalid token payload)",
        )

    user = get_user_by_id(db, int(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Foydalanuvchi topilmadi (User not found)",
        )

    if user.status == UserStatus.SUSPENDED.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hisobingiz vaqtincha to'xtatilgan (Account is suspended)",
        )

    from datetime import datetime, timezone
    user.last_activity_at = datetime.now(timezone.utc)
    db.commit()

    return user

def get_current_active_member(
    current_user: User = Depends(get_current_user)
) -> User:
    if current_user.status != UserStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A'zoligingiz tasdiqlanmagan. Iltimos, arizangiz ko'rib chiqilishini kuting. (Membership pending)",
        )
    return current_user

def require_roles(allowed_roles: List[str]) -> Callable:
    def role_checker(
        current_user: User = Depends(get_current_active_member)
    ) -> User:
        if current_user.has_role(RoleEnum.SUPER_ADMIN.value):
            return current_user

        has_any = any(current_user.has_role(r) for r in allowed_roles)
        if not has_any:
            roles_str = ", ".join(allowed_roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Ushbu amalni bajarish uchun ruxsat etilmagan. Talab qilinadigan rollar: {roles_str}",
            )
        return current_user

    return role_checker
