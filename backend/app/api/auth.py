"""
Authentication endpoints for Telegram WebApp and development sessions.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.api.deps import get_current_user
from app.models.user import User, RoleEnum, UserStatus
from app.schemas.user import TelegramAuthRequest, TokenResponse, UserResponse
from app.services.auth_service import verify_telegram_init_data, create_access_token
from app.services.user_service import get_or_create_user_from_telegram, assign_role_to_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/telegram", response_model=TokenResponse)
def authenticate_telegram(
    payload: TelegramAuthRequest,
    db: Session = Depends(get_db)
):
    auth_result = verify_telegram_init_data(payload.init_data)
    if not auth_result or not auth_result.get("user"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telegram autentifikatsiyasi muvaffaqiyatsiz bo'ldi (Invalid Telegram signature)",
        )

    tg_user = auth_result["user"]
    user = get_or_create_user_from_telegram(
        session=db,
        telegram_id=tg_user["id"],
        first_name=tg_user.get("first_name", ""),
        last_name=tg_user.get("last_name"),
        username=tg_user.get("username"),
        preferred_language=tg_user.get("language_code", "uz")
    )
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": str(user.id), "tg_id": user.telegram_id})
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))

@router.post("/dev-login", response_model=TokenResponse)
def dev_login(
    role: str = "super_admin",
    db: Session = Depends(get_db)
):
    if settings.ENVIRONMENT != "development":
        raise HTTPException(status_code=403, detail="Dev login is disabled in production")

    valid_roles = ["member", "evaluator", "senior_reviewer", "moderator", "super_admin"]
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Valid roles are: {', '.join(valid_roles)}")

    mock_tg_ids = {
        "member": 10001,
        "evaluator": 10002,
        "senior_reviewer": 10003,
        "moderator": 10004,
        "super_admin": 10005,
    }
    mock_names = {
        "member": ("Malika", "Zokirova", "malika_z"),
        "evaluator": ("Dr. Alisher", "Karimov", "akarimov"),
        "senior_reviewer": ("Prof. Sardor", "Nazarov", "snazarov"),
        "moderator": ("Dilshod", "Rahimov", "drahimov"),
        "super_admin": ("Admin", "ThinkSpace", "thinkadmin"),
    }

    first, last, uname = mock_names[role]
    tg_id = mock_tg_ids[role]

    user = get_or_create_user_from_telegram(
        session=db,
        telegram_id=tg_id,
        first_name=first,
        last_name=last,
        username=uname
    )
    user.status = UserStatus.APPROVED.value
    assign_role_to_user(db, user.id, role)
    if role != "member":
        assign_role_to_user(db, user.id, RoleEnum.MEMBER.value)

    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": str(user.id), "tg_id": user.telegram_id})
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    return UserResponse.model_validate(current_user)
