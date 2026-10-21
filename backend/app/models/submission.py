"""
Submission, versioning, and file models for ThinkSpace | UWED.
"""
from datetime import datetime, timezone
import enum
from typing import List, Optional
from sqlalchemy import (
    BigInteger,
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

class SubmissionStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    REVISION_REQUESTED = "revision_requested"
    RESUBMITTED = "resubmitted"
    AWAITING_MODERATOR = "awaiting_moderator"
    APPROVED = "approved"
    PUBLISHED = "published"
    REJECTED = "rejected"

class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    assignment_id: Mapped[int] = mapped_column(Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    current_version_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(35), default=SubmissionStatus.SUBMITTED.value, nullable=False, index=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("assignment_id", "user_id", name="uq_assignment_user_submission"),
    )

    assignment: Mapped["Assignment"] = relationship("Assignment", back_populates="submissions", lazy="selectin")
    user: Mapped["User"] = relationship("User", back_populates="submissions", lazy="selectin")
    versions: Mapped[List["SubmissionVersion"]] = relationship(
        "SubmissionVersion",
        back_populates="submission",
        cascade="all, delete-orphan",
        order_by="SubmissionVersion.version_number",
        lazy="selectin"
    )
    evaluations: Mapped[List["Evaluation"]] = relationship("Evaluation", back_populates="submission", lazy="selectin")
    published_grade: Mapped[Optional["PublishedGrade"]] = relationship("PublishedGrade", back_populates="submission", uselist=False, lazy="selectin")
    moderator_decisions: Mapped[List["ModeratorDecision"]] = relationship("ModeratorDecision", back_populates="submission", lazy="selectin")

    @property
    def latest_version(self) -> Optional["SubmissionVersion"]:
        if self.versions:
            return self.versions[-1]
        return None

class SubmissionVersion(Base):
    __tablename__ = "submission_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    submission_id: Mapped[int] = mapped_column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    text_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    link_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("submission_id", "version_number", name="uq_submission_version"),
    )

    submission: Mapped["Submission"] = relationship("Submission", back_populates="versions")
    files: Mapped[List["StoredFile"]] = relationship(
        "StoredFile",
        back_populates="submission_version",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

class StoredFile(Base):
    __tablename__ = "stored_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    submission_version_id: Mapped[int] = mapped_column(Integer, ForeignKey("submission_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    telegram_file_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    submission_version: Mapped["SubmissionVersion"] = relationship("SubmissionVersion", back_populates="files")
