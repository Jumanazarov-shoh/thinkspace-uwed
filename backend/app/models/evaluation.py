"""
Evaluation, Rubric Scoring, Moderation, and Published Grade models for ThinkSpace | UWED.
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
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class EvaluationStatus(str, enum.Enum):
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    DRAFT = "draft"
    SUBMITTED = "submitted"
    SUPERSEDED = "superseded"
    CANCELLED = "cancelled"

class ReviewStatus(str, enum.Enum):
    AWAITING_EVALUATION = "awaiting_evaluation"
    UNDER_EVALUATION = "under_evaluation"
    EVALUATION_COMPLETE = "evaluation_complete"
    NEEDS_REVIEW = "needs_review"
    SENIOR_REVIEW = "senior_review"
    MODERATOR_REVIEW = "moderator_review"
    FINALIZED = "finalized"

class ModeratorDecisionType(str, enum.Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    OVERRIDDEN = "overridden"
    RETURNED_TO_EVALUATOR = "returned_to_evaluator"

class ReviewRequestStatus(str, enum.Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    RESOLVED = "resolved"
    REJECTED = "rejected"

class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    submission_id: Mapped[int] = mapped_column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    submission_version_id: Mapped[int] = mapped_column(Integer, ForeignKey("submission_versions.id", ondelete="CASCADE"), nullable=False)
    evaluator_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    status: Mapped[str] = mapped_column(String(30), default=EvaluationStatus.DRAFT.value, nullable=False)
    total_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    general_feedback: Mapped[str] = mapped_column(Text, default="", nullable=False)
    internal_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    is_revision_requested: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    revision_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        # Prevent an evaluator from submitting more than one active review per submission version
        UniqueConstraint("submission_id", "evaluator_id", "submission_version_id", name="uq_evaluator_submission_version"),
    )

    submission: Mapped["Submission"] = relationship("Submission", back_populates="evaluations")
    evaluator: Mapped["User"] = relationship("User", foreign_keys=[evaluator_id], lazy="selectin")
    criterion_scores: Mapped[List["CriterionScore"]] = relationship(
        "CriterionScore",
        back_populates="evaluation",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

class CriterionScore(Base):
    __tablename__ = "criterion_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    evaluation_id: Mapped[int] = mapped_column(Integer, ForeignKey("evaluations.id", ondelete="CASCADE"), nullable=False, index=True)
    criterion_id: Mapped[int] = mapped_column(Integer, ForeignKey("rubric_criteria.id", ondelete="CASCADE"), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("evaluation_id", "criterion_id", name="uq_evaluation_criterion"),
    )

    evaluation: Mapped["Evaluation"] = relationship("Evaluation", back_populates="criterion_scores")
    criterion: Mapped["RubricCriterion"] = relationship("RubricCriterion", foreign_keys=[criterion_id], lazy="selectin")

class ModeratorDecision(Base):
    __tablename__ = "moderator_decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    submission_id: Mapped[int] = mapped_column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    moderator_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    decision: Mapped[str] = mapped_column(String(40), nullable=False)
    override_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    submission: Mapped["Submission"] = relationship("Submission", back_populates="moderator_decisions")
    moderator: Mapped["User"] = relationship("User", foreign_keys=[moderator_id], lazy="selectin")

class PublishedGrade(Base):
    __tablename__ = "published_grades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    submission_id: Mapped[int] = mapped_column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    assignment_id: Mapped[int] = mapped_column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    final_score: Mapped[float] = mapped_column(Float, nullable=False)
    max_score: Mapped[float] = mapped_column(Float, nullable=False)
    percentage: Mapped[float] = mapped_column(Float, nullable=False)
    overall_feedback: Mapped[str] = mapped_column(Text, default="", nullable=False)
    
    published_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    submission: Mapped["Submission"] = relationship("Submission", back_populates="published_grade")
    assignment: Mapped["Assignment"] = relationship("Assignment", foreign_keys=[assignment_id], lazy="selectin")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")
    publisher: Mapped["User"] = relationship("User", foreign_keys=[published_by_id], lazy="selectin")
    
    revisions: Mapped[List["GradeRevision"]] = relationship("GradeRevision", back_populates="published_grade", cascade="all, delete-orphan", lazy="selectin")
    review_requests: Mapped[List["ReviewRequest"]] = relationship("ReviewRequest", back_populates="published_grade", cascade="all, delete-orphan", lazy="selectin")

class GradeRevision(Base):
    __tablename__ = "grade_revisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    published_grade_id: Mapped[int] = mapped_column(Integer, ForeignKey("published_grades.id", ondelete="CASCADE"), nullable=False, index=True)
    previous_score: Mapped[float] = mapped_column(Float, nullable=False)
    new_score: Mapped[float] = mapped_column(Float, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    changed_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    published_grade: Mapped["PublishedGrade"] = relationship("PublishedGrade", back_populates="revisions")
    changed_by: Mapped["User"] = relationship("User", foreign_keys=[changed_by_id], lazy="selectin")

class ReviewRequest(Base):
    __tablename__ = "review_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    published_grade_id: Mapped[int] = mapped_column(Integer, ForeignKey("published_grades.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=ReviewRequestStatus.PENDING.value, nullable=False, index=True)
    
    resolver_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolution_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    published_grade: Mapped["PublishedGrade"] = relationship("PublishedGrade", back_populates="review_requests")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")
    resolver: Mapped[Optional["User"]] = relationship("User", foreign_keys=[resolver_id], lazy="selectin")

class EvaluatorAssignment(Base):
    __tablename__ = "evaluator_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    submission_id: Mapped[int] = mapped_column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    evaluator_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="assigned", nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("submission_id", "evaluator_id", name="uq_submission_evaluator_assignment"),
    )

    submission: Mapped["Submission"] = relationship("Submission", back_populates="evaluator_assignments")
    evaluator: Mapped["User"] = relationship("User", foreign_keys=[evaluator_id], lazy="selectin")
    assigned_by: Mapped["User"] = relationship("User", foreign_keys=[assigned_by_id], lazy="selectin")

class SeniorReview(Base):
    __tablename__ = "senior_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    submission_id: Mapped[int] = mapped_column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    senior_reviewer_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recommended_score: Mapped[float] = mapped_column(Float, nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    internal_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    escalate_to_moderator: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    submission: Mapped["Submission"] = relationship("Submission", back_populates="senior_reviews")
    senior_reviewer: Mapped["User"] = relationship("User", foreign_keys=[senior_reviewer_id], lazy="selectin")
