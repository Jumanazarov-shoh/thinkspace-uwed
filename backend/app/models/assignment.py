"""
Assignment and Rubric models for ThinkSpace | UWED.
"""
from datetime import datetime, timezone
import enum
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
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

class ThinkSpaceDirection(str, enum.Enum):
    READ = "Think & Read"
    DISCUSS = "Think & Discuss"
    ANALYZE = "Think & Analyze"
    LEAD = "Think & Lead"
    CREATE = "Think & Create"
    CONNECT = "Think & Connect"

class AssignmentStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    OPEN = "open"  # Compatible alias for published
    SCHEDULED = "scheduled"
    CLOSED = "closed"
    ARCHIVED = "archived"

class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    direction: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    reference_links: Mapped[List[dict]] = mapped_column(JSON, default=list, nullable=False)
    
    difficulty: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, default="intermediate")
    attachment_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    status: Mapped[str] = mapped_column(String(30), default=AssignmentStatus.DRAFT.value, nullable=False, index=True)
    publish_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    
    max_score: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    allowed_formats: Mapped[List[str]] = mapped_column(JSON, default=lambda: ["text", "link", "pdf", "image"], nullable=False)
    
    # Multi-admin evaluation settings
    min_evaluators: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    requires_moderation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    discrepancy_threshold: Mapped[float] = mapped_column(Float, default=15.0, nullable=False) # e.g. 15% score difference triggers escalation
    
    created_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
    rubrics: Mapped[List["Rubric"]] = relationship("Rubric", back_populates="assignment", cascade="all, delete-orphan", lazy="selectin")
    submissions: Mapped[List["Submission"]] = relationship("Submission", back_populates="assignment", lazy="selectin")

    @property
    def deadline(self) -> datetime:
        return self.deadline_at

    @property
    def published_at(self) -> Optional[datetime]:
        return self.publish_at

    @property
    def short_description(self) -> str:
        return self.description

    @property
    def active_rubric(self) -> Optional["Rubric"]:
        for r in self.rubrics:
            if r.is_active:
                return r
        return self.rubrics[0] if self.rubrics else None

class Rubric(Base):
    __tablename__ = "rubrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    assignment_id: Mapped[int] = mapped_column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("assignment_id", "version", name="uq_assignment_rubric_version"),
    )

    assignment: Mapped["Assignment"] = relationship("Assignment", back_populates="rubrics")
    criteria: Mapped[List["RubricCriterion"]] = relationship(
        "RubricCriterion",
        back_populates="rubric",
        cascade="all, delete-orphan",
        order_by="RubricCriterion.order_index",
        lazy="selectin"
    )

class RubricCriterion(Base):
    __tablename__ = "rubric_criteria"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    rubric_id: Mapped[int] = mapped_column(Integer, ForeignKey("rubrics.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    guidance: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    max_points: Mapped[float] = mapped_column(Float, nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    rubric: Mapped["Rubric"] = relationship("Rubric", back_populates="criteria")
