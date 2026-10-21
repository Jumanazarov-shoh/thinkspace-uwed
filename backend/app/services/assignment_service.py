"""
Assignment management service.
Handles assignment creation, rubric versioning, and access control.
"""
from datetime import datetime, timezone
import re
from typing import List, Optional
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from app.models.assignment import Assignment, Rubric, RubricCriterion, AssignmentStatus
from app.models.submission import Submission
from app.schemas.assignment import AssignmentCreate, AssignmentUpdate

def generate_slug(title: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", title.lower()).strip()
    slug = re.sub(r"[-\s]+", "-", slug)
    return slug

def create_assignment(
    session: Session,
    data: AssignmentCreate,
    creator_id: int
) -> Assignment:
    base_slug = data.slug or generate_slug(data.title)
    slug = base_slug
    counter = 1
    
    while True:
        stmt = select(Assignment).where(Assignment.slug == slug)
        res = session.execute(stmt)
        if not res.scalar_one_or_none():
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    assignment = Assignment(
        title=data.title,
        slug=slug,
        direction=data.direction,
        description=data.description,
        instructions=data.instructions,
        reference_links=data.reference_links,
        status=data.status,
        publish_at=data.publish_at or (datetime.now(timezone.utc) if data.status == AssignmentStatus.OPEN.value else None),
        deadline_at=data.deadline_at,
        max_score=data.max_score,
        allowed_formats=data.allowed_formats,
        min_evaluators=data.min_evaluators,
        requires_moderation=data.requires_moderation,
        discrepancy_threshold=data.discrepancy_threshold,
        created_by_id=creator_id,
    )
    session.add(assignment)
    session.flush()

    rubric = Rubric(
        assignment_id=assignment.id,
        version=1,
        is_active=True
    )
    session.add(rubric)
    session.flush()

    for idx, c in enumerate(data.criteria):
        crit = RubricCriterion(
            rubric_id=rubric.id,
            title=c.title,
            description=c.description,
            max_points=c.max_points,
            weight=c.weight,
            order_index=c.order_index or idx
        )
        session.add(crit)

    session.flush()
    return assignment

def get_assignment_by_id(session: Session, assignment_id: int) -> Optional[Assignment]:
    stmt = select(Assignment).where(Assignment.id == assignment_id)
    result = session.execute(stmt)
    return result.scalar_one_or_none()

def list_assignments(
    session: Session,
    direction: Optional[str] = None,
    status: Optional[str] = None,
    is_admin_or_evaluator: bool = False
) -> List[Assignment]:
    query = select(Assignment)

    if not is_admin_or_evaluator:
        query = query.where(
            or_(
                Assignment.status == AssignmentStatus.OPEN.value,
                Assignment.status == AssignmentStatus.CLOSED.value
            )
        )
    elif status:
        query = query.where(Assignment.status == status)

    if direction:
        query = query.where(Assignment.direction == direction)

    query = query.order_by(Assignment.deadline_at.desc())
    result = session.execute(query)
    return list(result.scalars().all())

def update_assignment(
    session: Session,
    assignment_id: int,
    data: AssignmentUpdate
) -> Optional[Assignment]:
    assignment = get_assignment_by_id(session, assignment_id)
    if not assignment:
        return None

    sub_count_stmt = select(Submission).where(Submission.assignment_id == assignment_id)
    sub_res = session.execute(sub_count_stmt)
    has_submissions = len(sub_res.scalars().all()) > 0

    if data.title is not None:
        assignment.title = data.title
    if data.direction is not None:
        assignment.direction = data.direction
    if data.description is not None:
        assignment.description = data.description
    if data.instructions is not None:
        assignment.instructions = data.instructions
    if data.reference_links is not None:
        assignment.reference_links = data.reference_links
    if data.status is not None:
        assignment.status = data.status
        if data.status == AssignmentStatus.OPEN.value and not assignment.publish_at:
            assignment.publish_at = datetime.now(timezone.utc)
    if data.deadline_at is not None:
        assignment.deadline_at = data.deadline_at
    if data.allowed_formats is not None:
        assignment.allowed_formats = data.allowed_formats
    if data.min_evaluators is not None:
        assignment.min_evaluators = data.min_evaluators
    if data.requires_moderation is not None:
        assignment.requires_moderation = data.requires_moderation
    if data.discrepancy_threshold is not None:
        assignment.discrepancy_threshold = data.discrepancy_threshold

    if data.criteria is not None:
        if has_submissions:
            current_active = assignment.active_rubric
            new_version_num = (current_active.version + 1) if current_active else 2
            if current_active:
                current_active.is_active = False

            new_rubric = Rubric(
                assignment_id=assignment.id,
                version=new_version_num,
                is_active=True
            )
            session.add(new_rubric)
            session.flush()

            for idx, c in enumerate(data.criteria):
                crit = RubricCriterion(
                    rubric_id=new_rubric.id,
                    title=c.title,
                    description=c.description,
                    max_points=c.max_points,
                    weight=c.weight,
                    order_index=c.order_index or idx
                )
                session.add(crit)
        else:
            active_rubric = assignment.active_rubric
            if active_rubric:
                for old_c in list(active_rubric.criteria):
                    session.delete(old_c)
                session.flush()
                for idx, c in enumerate(data.criteria):
                    crit = RubricCriterion(
                        rubric_id=active_rubric.id,
                        title=c.title,
                        description=c.description,
                        max_points=c.max_points,
                        weight=c.weight,
                        order_index=c.order_index or idx
                    )
                    session.add(crit)

    session.flush()
    return assignment
