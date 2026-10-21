"""
Pydantic schemas for User, Auth, and Membership.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import Field
from app.schemas.compat import CompatBaseModel

class UserBase(CompatBaseModel):
    telegram_id: int
    username: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    display_name: str
    student_id: Optional[str] = None
    faculty: Optional[str] = None
    phone: Optional[str] = None
    preferred_language: str = "uz"

class UserCreate(UserBase):
    pass

class UserUpdate(CompatBaseModel):
    display_name: Optional[str] = None
    student_id: Optional[str] = None
    faculty: Optional[str] = None
    phone: Optional[str] = None
    preferred_language: Optional[str] = None

class UserRoleResponse(CompatBaseModel):
    role_name: str
    granted_at: datetime

class UserResponse(CompatBaseModel):
    id: int
    telegram_id: int
    username: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    display_name: str
    student_id: Optional[str] = None
    faculty: Optional[str] = None
    phone: Optional[str] = None
    status: str
    preferred_language: str
    roles: List[UserRoleResponse] = []
    created_at: datetime
    updated_at: datetime
    last_activity_at: Optional[datetime] = None

class TelegramAuthRequest(CompatBaseModel):
    init_data: str

class TokenResponse(CompatBaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class RoleAssignRequest(CompatBaseModel):
    role_name: str

class MembershipRequestCreate(CompatBaseModel):
    statement: str = Field(..., min_length=10, max_length=2000)
    chosen_directions: List[str] = Field(..., min_items=1)
    student_id: Optional[str] = None
    faculty: Optional[str] = None
    phone: Optional[str] = None

class MembershipRequestReview(CompatBaseModel):
    action: str = Field(..., regex="^(approve|reject)$")
    review_comment: Optional[str] = None

class MembershipRequestResponse(CompatBaseModel):
    id: int
    user_id: int
    user: UserResponse
    statement: str
    chosen_directions: List[str]
    status: str
    reviewed_at: Optional[datetime] = None
    review_comment: Optional[str] = None
    created_at: datetime
