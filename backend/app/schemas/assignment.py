"""
Pydantic schemas for Assignments and Rubrics.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import Field, root_validator
from app.schemas.compat import CompatBaseModel

DIRECTION_MAPPING = {
    "think_read": "Think & Read",
    "think_discuss": "Think & Discuss",
    "think_analyze": "Think & Analyze",
    "think_lead": "Think & Lead",
    "think_create": "Think & Create",
    "think_connect": "Think & Connect",
    "think & read": "Think & Read",
    "think & discuss": "Think & Discuss",
    "think & analyze": "Think & Analyze",
    "think & lead": "Think & Lead",
    "think & create": "Think & Create",
    "think & connect": "Think & Connect",
}

VALID_DIRECTIONS = {
    "Think & Read",
    "Think & Discuss",
    "Think & Analyze",
    "Think & Lead",
    "Think & Create",
    "Think & Connect",
}

class RubricCriterionCreate(CompatBaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    guidance: Optional[str] = None
    max_points: float = Field(..., gt=0)
    weight: float = Field(default=1.0, gt=0)
    order_index: int = 0

class RubricCriterionUpdate(CompatBaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = None
    guidance: Optional[str] = None
    max_points: Optional[float] = Field(None, gt=0)
    order_index: Optional[int] = None

class RubricCriterionResponse(CompatBaseModel):
    id: int
    title: str
    description: Optional[str] = None
    guidance: Optional[str] = None
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
    direction: str
    description: Optional[str] = None
    short_description: Optional[str] = None
    instructions: Optional[str] = None
    reference_links: List[dict] = Field(default_factory=list)
    difficulty: Optional[str] = Field(default="intermediate")
    attachment_url: Optional[str] = None
    status: str = Field(default="draft")
    publish_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    deadline_at: Optional[datetime] = None
    deadline: Optional[datetime] = None
    max_score: int = Field(default=100, gt=0)
    allowed_formats: List[str] = Field(default_factory=lambda: ["text", "link", "pdf", "image"])
    min_evaluators: int = Field(default=1, ge=1, le=5)
    requires_moderation: bool = False
    discrepancy_threshold: float = Field(default=15.0, ge=0.0, le=100.0)
    criteria: Optional[List[RubricCriterionCreate]] = None

    @root_validator(pre=True)
    def normalize_fields(cls, values):
        # Normalize direction
        raw_direction = values.get("direction", "")
        if raw_direction in DIRECTION_MAPPING:
            values["direction"] = DIRECTION_MAPPING[raw_direction]
        elif raw_direction.lower() in DIRECTION_MAPPING:
            values["direction"] = DIRECTION_MAPPING[raw_direction.lower()]
        elif raw_direction not in VALID_DIRECTIONS:
            raise ValueError(f"Invalid direction: '{raw_direction}'. Must be one of: {sorted(list(VALID_DIRECTIONS))}")

        # Normalize description / short_description
        desc = values.get("description") or values.get("short_description")
        if not desc or len(str(desc).strip()) < 5:
            raise ValueError("Short description is required (min 5 characters).")
        values["description"] = desc
        values["short_description"] = desc

        # Normalize instructions
        instr = values.get("instructions") or desc
        if not instr or len(str(instr).strip()) < 5:
            raise ValueError("Full instructions are required (min 5 characters).")
        values["instructions"] = instr

        # Normalize deadline
        dl = values.get("deadline_at") or values.get("deadline")
        if not dl:
            raise ValueError("Deadline is required.")
        values["deadline_at"] = dl
        values["deadline"] = dl

        # Normalize status
        st = values.get("status", "draft").lower()
        if st not in ["draft", "published", "open", "closed", "archived", "scheduled"]:
            raise ValueError(f"Invalid status: '{st}'. Must be one of draft, published, open, closed, archived")
        values["status"] = st

        # Normalize criteria
        max_score = float(values.get("max_score") or 100)
        criteria = values.get("criteria")
        if not criteria:
            values["criteria"] = [
                {
                    "title": "Intellectual Depth & Critical Analysis",
                    "description": "Comprehensive reasoning and evaluation",
                    "max_points": max_score,
                    "weight": 1.0,
                    "order_index": 0
                }
            ]
        else:
            total = sum(float(c.get("max_points") if isinstance(c, dict) else c.max_points) for c in criteria)
            if abs(total - max_score) > 0.01:
                raise ValueError(f"The sum of rubric criterion max points ({total}) must match assignment max_score ({max_score})")

        return values

class AssignmentUpdate(CompatBaseModel):
    title: Optional[str] = None
    direction: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    instructions: Optional[str] = None
    reference_links: Optional[List[dict]] = None
    difficulty: Optional[str] = None
    attachment_url: Optional[str] = None
    status: Optional[str] = None
    publish_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    deadline_at: Optional[datetime] = None
    deadline: Optional[datetime] = None
    max_score: Optional[int] = None
    allowed_formats: Optional[List[str]] = None
    min_evaluators: Optional[int] = None
    requires_moderation: Optional[bool] = None
    discrepancy_threshold: Optional[float] = None
    criteria: Optional[List[RubricCriterionCreate]] = None

    @root_validator(pre=True)
    def normalize_update_fields(cls, values):
        raw_direction = values.get("direction")
        if raw_direction:
            if raw_direction in DIRECTION_MAPPING:
                values["direction"] = DIRECTION_MAPPING[raw_direction]
            elif raw_direction.lower() in DIRECTION_MAPPING:
                values["direction"] = DIRECTION_MAPPING[raw_direction.lower()]
            elif raw_direction not in VALID_DIRECTIONS:
                raise ValueError(f"Invalid direction: '{raw_direction}'. Must be one of: {sorted(list(VALID_DIRECTIONS))}")

        if "short_description" in values and "description" not in values:
            values["description"] = values["short_description"]
        if "deadline" in values and "deadline_at" not in values:
            values["deadline_at"] = values["deadline"]

        if "status" in values and values["status"]:
            st = values["status"].lower()
            if st not in ["draft", "published", "open", "closed", "archived", "scheduled"]:
                raise ValueError(f"Invalid status: '{st}'.")
            values["status"] = st

        return values

class AssignmentResponse(CompatBaseModel):
    id: int
    title: str
    slug: str
    direction: str
    description: str
    short_description: Optional[str] = None
    instructions: str
    reference_links: List[dict]
    difficulty: Optional[str] = "intermediate"
    attachment_url: Optional[str] = None
    status: str
    publish_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    deadline_at: datetime
    deadline: Optional[datetime] = None
    max_score: int
    allowed_formats: List[str]
    min_evaluators: int
    requires_moderation: bool
    discrepancy_threshold: float
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    active_rubric: Optional[RubricResponse] = None
    my_submission_status: Optional[str] = None

    @root_validator
    def populate_aliases(cls, values):
        if not values.get("short_description"):
            values["short_description"] = values.get("description")
        if not values.get("deadline"):
            values["deadline"] = values.get("deadline_at")
        if not values.get("published_at"):
            values["published_at"] = values.get("publish_at")
        return values
