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
    EvaluatorAssignment,
    SeniorReview,
    EvaluationStatus,
    ReviewStatus,
    ModeratorDecisionType,
    ReviewRequestStatus
)
from app.models.audit import AuditLog, NotificationRecord
from app.models.notification import (
    Notification,
    NotificationPreference,
    DeadlineReminderLog,
    NotificationType,
)
from app.models.points import (
    PointTransaction,
    PointTransactionType,
)

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
    "EvaluatorAssignment",
    "SeniorReview",
    "EvaluationStatus",
    "ReviewStatus",
    "ModeratorDecisionType",
    "ReviewRequestStatus",
    "AuditLog",
    "NotificationRecord",
    "Notification",
    "NotificationPreference",
    "DeadlineReminderLog",
    "NotificationType",
    "PointTransaction",
    "PointTransactionType",
]
