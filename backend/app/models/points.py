"""
Points Ledger and Transaction Models for ThinkSpace | UWED.
Maintains an immutable, auditable history of all points earned or adjusted.
"""
import enum
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, Float, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class PointTransactionType(str, enum.Enum):
    ASSIGNMENT_PERFORMANCE = "assignment_performance"
    ASSIGNMENT_COMPLETION = "assignment_completion"
    ON_TIME_BONUS = "on_time_bonus"
    MANUAL_ADJUSTMENT = "manual_adjustment"
    SCORE_CORRECTION = "score_correction"
    REVERSAL = "reversal"

class PointTransaction(Base):
    __tablename__ = "point_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    assignment_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("assignments.id", ondelete="SET NULL"), nullable=True, index=True)
    
    transaction_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    points: Mapped[float] = mapped_column(Float, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    
    source_entity_type: Mapped[str] = mapped_column(String(50), default="published_grade", nullable=False)
    source_entity_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    created_by_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    __table_args__ = (
        Index("ix_point_user_type", "user_id", "transaction_type"),
        Index("ix_point_user_assign", "user_id", "assignment_id"),
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")
    assignment: Mapped[Optional["Assignment"]] = relationship("Assignment", foreign_keys=[assignment_id], lazy="selectin")
    created_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
