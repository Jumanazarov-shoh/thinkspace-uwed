"""
Pydantic schemas for Assignments and Rubrics.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import Field, root_validator
from app.schemas.compat import CompatBaseModel

class RubricCriterionCreate(CompatBaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    max_points: float = Field(..., gt=0)
    weight: float = Field(default=1.0, gt=0)
    order_index: int = 0

class RubricCriterionResponse(CompatBaseModel):
    id: int
    title: str
    description: Optional[str] = None
    max_points: float
    weight: float
    order_index: int

class RubricResponse(CompatBaseModel):
    id: int
    version: int
    is_active: bool
    criteria: List[RubricCriterionResponse] = []
    created_at: datetime

class AssignmentCreate(CompatBaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    slug: Optional[str] = None
    direction: str = Field(..., regex="^(Think & Read|Think & Discuss|Think & Analyze|Think & Lead|Think & Create|Think & Connect)$")
    description: str = Field(..., min_length=10)
    instructions: str = Field(..., min_length=10)
    reference_links: List[dict] = Field(default_factory=list)
    status: str = Field(default="draft", regex="^(draft|scheduled|open|closed|archived)$")
    publish_at: Optional[datetime] = None
    deadline_at: datetime
    max_score: int = Field(default=100, gt=0)
    allowed_formats: List[str] = Field(default_factory=lambda: ["text", "link", "pdf", "image"])
    min_evaluators: int = Field(default=1, ge=1, le=5)
    requires_moderation: bool = False
    discrepancy_threshold: float = Field(default=15.0, ge=0.0, le=100.0)
    criteria: List[RubricCriterionCreate] = Field(..., min_items=1)

    @root_validator
    def validate_criteria_and_deadlines(cls, values):
        criteria = values.get("criteria") or []
        max_score = values.get("max_score") or 100
        total_criteria_points = sum(c.max_points for c in criteria)
        if abs(total_criteria_points - max_score) > 0.01:
            raise ValueError(
                f"The sum of rubric criterion max points ({total_criteria_points}) must match assignment max_score ({max_score})"
            )
        return values

class AssignmentUpdate(CompatBaseModel):
    title: Optional[str] = None
    direction: Optional[str] = Field(None, regex="^(Think & Read|Think & Discuss|Think & Analyze|Think & Lead|Think & Create|Think & Connect)$")
    description: Optional[str] = None
    instructions: Optional[str] = None
    reference_links: Optional[List[dict]] = None
    status: Optional[str] = Field(None, regex="^(draft|scheduled|open|closed|archived)$")
    publish_at: Optional[datetime] = None
    deadline_at: Optional[datetime] = None
    max_score: Optional[int] = None
    allowed_formats: Optional[List[str]] = None
    min_evaluators: Optional[int] = None
    requires_moderation: Optional[bool] = None
    discrepancy_threshold: Optional[float] = None
    criteria: Optional[List[RubricCriterionCreate]] = None

class AssignmentResponse(CompatBaseModel):
    id: int
    title: str
    slug: str
    direction: str
    description: str
    instructions: str
    reference_links: List[dict]
    status: str
    publish_at: Optional[datetime] = None
    deadline_at: datetime
    max_score: int
    allowed_formats: List[str]
    min_evaluators: int
    requires_moderation: bool
    discrepancy_threshold: float
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    active_rubric: Optional[RubricResponse] = None
