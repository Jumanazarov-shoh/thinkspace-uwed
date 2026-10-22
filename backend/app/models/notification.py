"""
Notification, Preference, and Deadline Reminder models for ThinkSpace | UWED.
"""
from datetime import datetime, timezone
import enum
from typing import Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class NotificationType(str, enum.Enum):
    ASSIGNMENT_PUBLISHED = "assignment_published"
    DEADLINE_REMINDER = "deadline_reminder"
    DEADLINE_REACHED = "deadline_reached"
    SUBMISSION_RECEIVED = "submission_received"
    SUBMISSION_LATE = "submission_late"
    EVALUATION_FINALIZED = "evaluation_finalized"
    FEEDBACK_AVAILABLE = "feedback_available"
    SYSTEM_ANNOUNCEMENT = "system_announcement"

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Optional entity linkage for frontend deep-linking
    related_entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True) # "assignment", "submission", "evaluation", "announcement"
    related_entity_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # In-app status
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    # Delivery tracking
    delivery_status: Mapped[str] = mapped_column(String(30), default="delivered", nullable=False) # "delivered", "pending", "failed"
    telegram_delivery_status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False) # "sent", "failed", "disabled", "pending"
    telegram_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")

class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    telegram_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    deadline_reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")

class DeadlineReminderLog(Base):
    __tablename__ = "deadline_reminder_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    assignment_id: Mapped[int] = mapped_column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reminder_window: Mapped[str] = mapped_column(String(20), nullable=False, index=True) # "24h", "3h"
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("assignment_id", "user_id", "reminder_window", name="uq_reminder_dedup"),
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")
    assignment: Mapped["Assignment"] = relationship("Assignment", foreign_keys=[assignment_id], lazy="selectin")
