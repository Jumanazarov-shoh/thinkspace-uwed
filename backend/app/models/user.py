"""
User and Role models for ThinkSpace | UWED.
"""
from datetime import datetime, timezone
import enum
from typing import List, Optional
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class UserStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"

class RoleEnum(str, enum.Enum):
    MEMBER = "member"
    EVALUATOR = "evaluator"
    SENIOR_REVIEWER = "senior_reviewer"
    MODERATOR = "moderator"
    SUPER_ADMIN = "super_admin"

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True, nullable=False)
    username: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    first_name: Mapped[str] = mapped_column(String(150), nullable=False)
    last_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    student_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    faculty: Mapped[Optional[str]] = mapped_column(String(250), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default=UserStatus.PENDING.value, nullable=False, index=True)
    
    # Language preference (uz or en)
    preferred_language: Mapped[str] = mapped_column(String(10), default="uz", nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    roles: Mapped[List["UserRole"]] = relationship(
        "UserRole",
        back_populates="user",
        foreign_keys="[UserRole.user_id]",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    membership_requests: Mapped[List["MembershipRequest"]] = relationship(
        "MembershipRequest",
        back_populates="user",
        foreign_keys="[MembershipRequest.user_id]",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    submissions: Mapped[List["Submission"]] = relationship(
        "Submission",
        back_populates="user",
        foreign_keys="[Submission.user_id]",
        lazy="selectin"
    )

    def has_role(self, role_name: str) -> bool:
        return any(r.role_name == role_name for r in self.roles) or any(r.role_name == RoleEnum.SUPER_ADMIN.value for r in self.roles)

    @property
    def role_names(self) -> List[str]:
        return [r.role_name for r in self.roles]

class UserRole(Base):
    __tablename__ = "user_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_name: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    granted_by_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "role_name", name="uq_user_role"),
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="roles")

class MembershipRequest(Base):
    __tablename__ = "membership_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    chosen_directions: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=UserStatus.PENDING.value, nullable=False, index=True)
    
    reviewed_by_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    review_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="membership_requests")
    reviewer: Mapped[Optional["User"]] = relationship("User", foreign_keys=[reviewed_by_id])
