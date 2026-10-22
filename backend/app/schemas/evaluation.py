"""
Pydantic schemas for Evaluations, Rubric Scoring, Moderation, and Published Grades.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import Field
from app.schemas.compat import CompatBaseModel
from app.schemas.user import UserResponse

class CriterionScoreInput(CompatBaseModel):
    criterion_id: int
    score: float = Field(..., ge=0)
    comment: Optional[str] = None

class CriterionScoreResponse(CompatBaseModel):
    id: int
    criterion_id: int
    score: float
    comment: Optional[str] = None

class EvaluationCreate(CompatBaseModel):
    submission_id: int
    general_feedback: str = Field(..., min_length=5)
    internal_notes: Optional[str] = None
    is_revision_requested: bool = False
    revision_notes: Optional[str] = None
    is_draft: bool = False
    criterion_scores: List[CriterionScoreInput] = Field(default_factory=list)

class EvaluationResponse(CompatBaseModel):
    id: int
    submission_id: int
    submission_version_id: int
    evaluator_id: int
    evaluator: Optional[UserResponse] = None
    status: str
    total_score: float
    general_feedback: str
    internal_notes: Optional[str] = None
    is_revision_requested: bool
    revision_notes: Optional[str] = None
    criterion_scores: List[CriterionScoreResponse] = []
    created_at: datetime
    submitted_at: Optional[datetime] = None

class EvaluatorAssignmentCreate(CompatBaseModel):
    evaluator_id: int

class EvaluatorAssignmentResponse(CompatBaseModel):
    id: int
    submission_id: int
    evaluator_id: int
    evaluator_name: Optional[str] = None
    evaluator_username: Optional[str] = None
    assigned_by_id: int
    status: str
    assigned_at: datetime

class SeniorReviewCreate(CompatBaseModel):
    recommended_score: float = Field(..., ge=0)
    rationale: str = Field(..., min_length=5)
    internal_notes: Optional[str] = None
    escalate_to_moderator: bool = False

class SeniorReviewResponse(CompatBaseModel):
    id: int
    submission_id: int
    senior_reviewer_id: int
    senior_reviewer_name: Optional[str] = None
    recommended_score: float
    rationale: str
    internal_notes: Optional[str] = None
    escalate_to_moderator: bool
    created_at: datetime

class ModeratorFinalizeCreate(CompatBaseModel):
    final_score: float = Field(..., ge=0)
    rationale: str = Field(..., min_length=5)

class SubmissionEvaluationOverviewItem(CompatBaseModel):
    submission_id: int
    assignment_id: int
    assignment_title: str
    direction: str
    member_name: str
    member_id: int
    submitted_at: Optional[datetime] = None
    is_late: bool = False
    submission_status: str
    review_status: str
    max_score: float
    assigned_evaluators: List[dict] = []
    evaluations_count: int = 0
    evaluations: List[dict] = []
    average_score: Optional[float] = None
    score_difference: Optional[float] = None
    difference_percentage: Optional[float] = None
    is_discrepant: bool = False
    final_score: Optional[float] = None

class MemberResultResponse(CompatBaseModel):
    assignment_id: int
    assignment_title: str
    direction: str
    submission_id: int
    review_status: str
    is_finalized: bool
    final_score: Optional[float] = None
    max_score: Optional[float] = None
    percentage: Optional[float] = None
    overall_feedback: Optional[str] = None
    finalized_at: Optional[datetime] = None
    criteria_breakdown: List[dict] = []

class ModeratorDecisionCreate(CompatBaseModel):
    decision: str = Field(..., pattern="^(approved|rejected|overridden|returned_to_evaluator)$")
    override_score: Optional[float] = None
    rationale: str = Field(..., min_length=5)

class ModeratorDecisionResponse(CompatBaseModel):
    id: int
    submission_id: int
    moderator_id: int
    moderator: Optional[UserResponse] = None
    decision: str
    override_score: Optional[float] = None
    rationale: str
    created_at: datetime

class GradeRevisionResponse(CompatBaseModel):
    id: int
    previous_score: float
    new_score: float
    reason: str
    changed_by_id: int
    changed_at: datetime

class PublishedGradeResponse(CompatBaseModel):
    id: int
    submission_id: int
    assignment_id: int
    user_id: int
    final_score: float
    max_score: float
    percentage: float
    overall_feedback: str
    published_by_id: int
    published_at: datetime
    revisions: List[GradeRevisionResponse] = []

class GradeRevisionCreate(CompatBaseModel):
    new_score: float = Field(..., ge=0)
    reason: str = Field(..., min_length=5)

class ReviewRequestCreate(CompatBaseModel):
    reason: str = Field(..., min_length=15, max_length=2000)

class ReviewRequestResolve(CompatBaseModel):
    action: str = Field(..., pattern="^(resolve|reject)$")
    resolution_comment: str = Field(..., min_length=5)
    adjusted_score: Optional[float] = None

class ReviewRequestResponse(CompatBaseModel):
    id: int
    published_grade_id: int
    user_id: int
    reason: str
    status: str
    resolution_comment: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
