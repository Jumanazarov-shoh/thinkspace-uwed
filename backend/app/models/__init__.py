"""
Export all models for Alembic and SQLAlchemy discovery.
"""
from app.models.user import User, UserRole, MembershipRequest, UserStatus, RoleEnum
from app.models.assignment import Assignment, Rubric, RubricCriterion, AssignmentStatus, ThinkSpaceDirection
from app.models.submission import Submission, SubmissionVersion, StoredFile, SubmissionStatus
from app.models.evaluation import (
    Evaluation,
    CriterionScore,
    ModeratorDecision,
    PublishedGrade,
    GradeRevision,
    ReviewRequest,
    EvaluationStatus,
    ModeratorDecisionType,
    ReviewRequestStatus
)
from app.models.audit import AuditLog, NotificationRecord

__all__ = [
    "User",
    "UserRole",
    "MembershipRequest",
    "UserStatus",
    "RoleEnum",
    "Assignment",
    "Rubric",
    "RubricCriterion",
    "AssignmentStatus",
    "ThinkSpaceDirection",
    "Submission",
    "SubmissionVersion",
    "StoredFile",
    "SubmissionStatus",
    "Evaluation",
    "CriterionScore",
    "ModeratorDecision",
    "PublishedGrade",
    "GradeRevision",
    "ReviewRequest",
    "EvaluationStatus",
    "ModeratorDecisionType",
    "ReviewRequestStatus",
    "AuditLog",
    "NotificationRecord",
]
