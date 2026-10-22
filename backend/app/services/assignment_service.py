"""
Assignment management service.
Handles assignment creation, rubric versioning, status lifecycle, access control, and audit logging.
"""
from datetime import datetime, timezone
import re
from typing import List, Optional
from sqlalchemy import select, or_, case
from sqlalchemy.orm import Session
from app.models.assignment import Assignment, Rubric, RubricCriterion, AssignmentStatus
from app.models.submission import Submission
from app.models.audit import AuditLog
from app.schemas.assignment import AssignmentCreate, AssignmentUpdate
from app.services.notification_service import notify_assignment_published

DIRECTION_MAP = {
    "think_read": "Think & Read",
    "think_discuss": "Think & Discuss",
    "think_analyze": "Think & Analyze",
    "think_lead": "Think & Lead",
    "think_create": "Think & Create",
    "think_connect": "Think & Connect",
}

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def generate_slug(title: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", title.lower()).strip()
    slug = re.sub(r"[-\s]+", "-", slug)
    return slug or "assignment"

def create_assignment(
    session: Session,
    data: AssignmentCreate,
    creator_id: int,
    ip_address: Optional[str] = None
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

    status = data.status
    publish_at = data.publish_at or data.published_at
    if status in [AssignmentStatus.PUBLISHED.value, AssignmentStatus.OPEN.value] and not publish_at:
        publish_at = utc_now()

    deadline_at = data.deadline_at or data.deadline or utc_now()
    direction = DIRECTION_MAP.get(data.direction.lower(), data.direction)

    assignment = Assignment(
        title=data.title,
        slug=slug,
        direction=direction,
        description=data.description or data.short_description or "",
        instructions=data.instructions or data.description or "",
        reference_links=data.reference_links,
        difficulty=data.difficulty or "intermediate",
        attachment_url=data.attachment_url,
        status=status,
        publish_at=publish_at,
        deadline_at=deadline_at,
        max_score=data.max_score,
        allowed_formats=data.allowed_formats,
        min_evaluators=data.min_evaluators,
        requires_moderation=data.requires_moderation,
        discrepancy_threshold=data.discrepancy_threshold,
        created_by_id=creator_id,
    )
    session.add(assignment)
    session.flush()

    # Create active rubric
    rubric = Rubric(
        assignment_id=assignment.id,
        version=1,
        is_active=True
    )
    session.add(rubric)
    session.flush()

    criteria = data.criteria or []
    for idx, c in enumerate(criteria):
        title = c.title if hasattr(c, "title") else c.get("title", "")
        description = c.description if hasattr(c, "description") else c.get("description", "")
        max_points = c.max_points if hasattr(c, "max_points") else c.get("max_points", assignment.max_score)
        weight = c.weight if hasattr(c, "weight") else c.get("weight", 1.0)
        order_index = c.order_index if hasattr(c, "order_index") else c.get("order_index", idx)

        crit = RubricCriterion(
            rubric_id=rubric.id,
            title=title,
            description=description,
            max_points=max_points,
            weight=weight,
            order_index=order_index or idx
        )
        session.add(crit)

    # Audit log
    audit = AuditLog(
        user_id=creator_id,
        action="ASSIGNMENT_CREATED",
        entity_type="assignment",
        entity_id=str(assignment.id),
        details={
            "title": assignment.title,
            "direction": assignment.direction,
            "status": assignment.status,
            "max_score": assignment.max_score,
            "deadline": assignment.deadline_at.isoformat(),
        },
        ip_address=ip_address
    )
    session.add(audit)
    session.flush()

    if assignment.status in (AssignmentStatus.PUBLISHED.value, AssignmentStatus.OPEN.value):
        try:
            notify_assignment_published(session, assignment)
        except Exception:
            pass

    return assignment

def get_assignment_by_id(session: Session, assignment_id: int) -> Optional[Assignment]:
    stmt = select(Assignment).where(Assignment.id == assignment_id)
    result = session.execute(stmt)
    return result.scalar_one_or_none()

def list_assignments(
    session: Session,
    direction: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    is_admin_or_evaluator: bool = False
) -> List[Assignment]:
    query = select(Assignment)

    # Visibility filtering
    if not is_admin_or_evaluator:
        # Standard member: only published / open and closed
        allowed_statuses = [
            AssignmentStatus.PUBLISHED.value,
            AssignmentStatus.OPEN.value,
            AssignmentStatus.CLOSED.value
        ]
        if status:
            st = status.lower()
            if st in ["active", "published", "open"]:
                query = query.where(
                    or_(
                        Assignment.status == AssignmentStatus.PUBLISHED.value,
                        Assignment.status == AssignmentStatus.OPEN.value
                    )
                )
            elif st == "closed":
                query = query.where(Assignment.status == AssignmentStatus.CLOSED.value)
            else:
                # Member cannot see draft or archived
                return []
        else:
            query = query.where(Assignment.status.in_(allowed_statuses))
    else:
        # Staff: can filter by any status
        if status:
            st = status.lower()
            if st == "open" or st == "published":
                query = query.where(
                    or_(
                        Assignment.status == AssignmentStatus.PUBLISHED.value,
                        Assignment.status == AssignmentStatus.OPEN.value
                    )
                )
            else:
                query = query.where(Assignment.status == st)

    # Direction filtering
    if direction and direction.lower() != "all":
        norm_dir = DIRECTION_MAP.get(direction.lower(), direction)
        query = query.where(Assignment.direction == norm_dir)

    # Search keyword
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                Assignment.title.ilike(term),
                Assignment.description.ilike(term),
                Assignment.instructions.ilike(term)
            )
        )

    # Priority sorting:
    # 1. Published / Open
    # 2. Draft
    # 3. Closed
    # 4. Archived
    # Within active: nearest deadline first
    status_order = case(
        (Assignment.status.in_([AssignmentStatus.PUBLISHED.value, AssignmentStatus.OPEN.value]), 1),
        (Assignment.status == AssignmentStatus.DRAFT.value, 2),
        (Assignment.status == AssignmentStatus.CLOSED.value, 3),
        (Assignment.status == AssignmentStatus.ARCHIVED.value, 4),
        else_=5
    )

    query = query.order_by(status_order, Assignment.deadline_at.asc())
    result = session.execute(query)
    return list(result.scalars().all())

def update_assignment(
    session: Session,
    assignment_id: int,
    data: AssignmentUpdate,
    actor_id: Optional[int] = None,
    ip_address: Optional[str] = None
) -> Optional[Assignment]:
    assignment = get_assignment_by_id(session, assignment_id)
    if not assignment:
        return None

    changes = {}

    if data.title is not None and data.title != assignment.title:
        changes["title"] = {"old": assignment.title, "new": data.title}
        assignment.title = data.title

    if data.direction is not None:
        norm_dir = DIRECTION_MAP.get(data.direction.lower(), data.direction)
        if norm_dir != assignment.direction:
            changes["direction"] = {"old": assignment.direction, "new": norm_dir}
            assignment.direction = norm_dir

    desc = data.description or data.short_description
    if desc is not None and desc != assignment.description:
        changes["description"] = "updated"
        assignment.description = desc

    if data.instructions is not None and data.instructions != assignment.instructions:
        changes["instructions"] = "updated"
        assignment.instructions = data.instructions

    if data.reference_links is not None:
        assignment.reference_links = data.reference_links

    if data.difficulty is not None and data.difficulty != assignment.difficulty:
        changes["difficulty"] = {"old": assignment.difficulty, "new": data.difficulty}
        assignment.difficulty = data.difficulty

    if data.attachment_url is not None:
        assignment.attachment_url = data.attachment_url

    if data.status is not None and data.status != assignment.status:
        st = data.status.lower()
        if st == "open":
            st = AssignmentStatus.PUBLISHED.value
        changes["status"] = {"old": assignment.status, "new": st}
        assignment.status = st
        if st == AssignmentStatus.PUBLISHED.value and not assignment.publish_at:
            assignment.publish_at = utc_now()

    deadline = data.deadline_at or data.deadline
    if deadline is not None and deadline != assignment.deadline_at:
        changes["deadline"] = {"old": assignment.deadline_at.isoformat(), "new": deadline.isoformat()}
        assignment.deadline_at = deadline

    if data.max_score is not None:
        assignment.max_score = data.max_score
    if data.allowed_formats is not None:
        assignment.allowed_formats = data.allowed_formats
    if data.min_evaluators is not None:
        assignment.min_evaluators = data.min_evaluators
    if data.requires_moderation is not None:
        assignment.requires_moderation = data.requires_moderation
    if data.discrepancy_threshold is not None:
        assignment.discrepancy_threshold = data.discrepancy_threshold

    # Audit log
    if changes and actor_id:
        audit = AuditLog(
            user_id=actor_id,
            action="ASSIGNMENT_UPDATED",
            entity_type="assignment",
            entity_id=str(assignment.id),
            details=changes,
            ip_address=ip_address
        )
        session.add(audit)

    session.flush()

    if "status" in changes and changes["status"]["new"] == AssignmentStatus.PUBLISHED.value and changes["status"]["old"] != AssignmentStatus.PUBLISHED.value:
        try:
            notify_assignment_published(session, assignment)
        except Exception:
            pass

    return assignment

def publish_assignment(
    session: Session,
    assignment_id: int,
    actor_id: int,
    ip_address: Optional[str] = None
) -> Optional[Assignment]:
    assignment = get_assignment_by_id(session, assignment_id)
    if not assignment:
        return None

    prev_status = assignment.status
    assignment.status = AssignmentStatus.PUBLISHED.value
    assignment.publish_at = utc_now()

    audit = AuditLog(
        user_id=actor_id,
        action="ASSIGNMENT_PUBLISHED",
        entity_type="assignment",
        entity_id=str(assignment.id),
        details={"previous_status": prev_status, "new_status": assignment.status, "published_at": assignment.publish_at.isoformat()},
        ip_address=ip_address
    )
    session.add(audit)
    session.flush()

    if prev_status not in (AssignmentStatus.PUBLISHED.value, AssignmentStatus.OPEN.value):
        try:
            notify_assignment_published(session, assignment)
        except Exception:
            pass

    return assignment

def close_assignment(
    session: Session,
    assignment_id: int,
    actor_id: int,
    ip_address: Optional[str] = None
) -> Optional[Assignment]:
    assignment = get_assignment_by_id(session, assignment_id)
    if not assignment:
        return None

    prev_status = assignment.status
    assignment.status = AssignmentStatus.CLOSED.value

    audit = AuditLog(
        user_id=actor_id,
        action="ASSIGNMENT_CLOSED",
        entity_type="assignment",
        entity_id=str(assignment.id),
        details={"previous_status": prev_status, "new_status": assignment.status},
        ip_address=ip_address
    )
    session.add(audit)
    session.flush()
    return assignment

def archive_assignment(
    session: Session,
    assignment_id: int,
    actor_id: int,
    ip_address: Optional[str] = None
) -> Optional[Assignment]:
    assignment = get_assignment_by_id(session, assignment_id)
    if not assignment:
        return None

    prev_status = assignment.status
    assignment.status = AssignmentStatus.ARCHIVED.value

    audit = AuditLog(
        user_id=actor_id,
        action="ASSIGNMENT_ARCHIVED",
        entity_type="assignment",
        entity_id=str(assignment.id),
        details={"previous_status": prev_status, "new_status": assignment.status},
        ip_address=ip_address
    )
    session.add(audit)
    session.flush()
    return assignment

def revert_to_draft(
    session: Session,
    assignment_id: int,
    actor_id: int,
    ip_address: Optional[str] = None
) -> Optional[Assignment]:
    assignment = get_assignment_by_id(session, assignment_id)
    if not assignment:
        return None

    prev_status = assignment.status
    assignment.status = AssignmentStatus.DRAFT.value

    audit = AuditLog(
        user_id=actor_id,
        action="ASSIGNMENT_REVERTED_TO_DRAFT",
        entity_type="assignment",
        entity_id=str(assignment.id),
        details={"previous_status": prev_status, "new_status": assignment.status},
        ip_address=ip_address
    )
    session.add(audit)
    session.flush()
    return assignment

def delete_assignment(
    session: Session,
    assignment_id: int,
    actor_id: int,
    ip_address: Optional[str] = None
) -> bool:
    assignment = get_assignment_by_id(session, assignment_id)
    if not assignment:
        return False

    # Check submissions
    sub_count_stmt = select(Submission).where(Submission.assignment_id == assignment_id)
    sub_res = session.execute(sub_count_stmt)
    if len(sub_res.scalars().all()) > 0:
        raise ValueError("Cannot delete an assignment that already has submitted work.")

    audit = AuditLog(
        user_id=actor_id,
        action="ASSIGNMENT_DELETED",
        entity_type="assignment",
        entity_id=str(assignment.id),
        details={"title": assignment.title, "direction": assignment.direction},
        ip_address=ip_address
    )
    session.add(audit)

    session.delete(assignment)
    session.flush()
    return True

def get_assignment_rubric(session: Session, assignment_id: int) -> Optional[Rubric]:
    stmt = select(Rubric).where(Rubric.assignment_id == assignment_id, Rubric.is_active == True)
    rubric = session.execute(stmt).scalar_one_or_none()
    if not rubric:
        stmt_any = select(Rubric).where(Rubric.assignment_id == assignment_id)
        rubric = session.execute(stmt_any).scalars().first()
    return rubric

def _check_evaluations_started(session: Session, assignment_id: int):
    """Prevent dangerous rubric modifications once evaluations have started."""
    from app.models.evaluation import Evaluation
    sub_ids_stmt = select(Submission.id).where(Submission.assignment_id == assignment_id)
    sub_ids = list(session.execute(sub_ids_stmt).scalars().all())
    if sub_ids:
        eval_stmt = select(Evaluation).where(
            Evaluation.submission_id.in_(sub_ids),
            Evaluation.status != "draft"
        )
        if session.execute(eval_stmt).scalars().first():
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail="Ushbu topshiriq bo'yicha baholash boshlangan. Mezonlarni o'zgartirish yoki o'chirish taqiqlanadi."
            )

def add_rubric_criterion(
    session: Session,
    assignment_id: int,
    data,
    actor_id: int
) -> RubricCriterion:
    assignment = get_assignment_by_id(session, assignment_id)
    if not assignment:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Topshiriq topilmadi")

    _check_evaluations_started(session, assignment_id)

    rubric = get_assignment_rubric(session, assignment_id)
    if not rubric:
        rubric = Rubric(assignment_id=assignment.id, version=1, is_active=True)
        session.add(rubric)
        session.flush()

    title = data.title
    description = data.description
    guidance = getattr(data, "guidance", None)
    max_points = data.max_points
    weight = getattr(data, "weight", 1.0)
    order_index = getattr(data, "order_index", len(rubric.criteria))

    crit = RubricCriterion(
        rubric_id=rubric.id,
        title=title,
        description=description,
        guidance=guidance,
        max_points=max_points,
        weight=weight,
        order_index=order_index
    )
    session.add(crit)
    session.flush()

    audit = AuditLog(
        user_id=actor_id,
        action="RUBRIC_CRITERION_ADDED",
        entity_type="rubric_criterion",
        entity_id=str(crit.id),
        details={"assignment_id": assignment_id, "title": title, "max_points": max_points}
    )
    session.add(audit)
    session.flush()
    return crit

def update_rubric_criterion(
    session: Session,
    assignment_id: int,
    criterion_id: int,
    data,
    actor_id: int
) -> RubricCriterion:
    _check_evaluations_started(session, assignment_id)

    stmt = select(RubricCriterion).where(RubricCriterion.id == criterion_id)
    crit = session.execute(stmt).scalar_one_or_none()
    if not crit:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Rubrika mezoni topilmadi")

    if data.title is not None:
        crit.title = data.title
    if data.description is not None:
        crit.description = data.description
    if hasattr(data, "guidance") and data.guidance is not None:
        crit.guidance = data.guidance
    if data.max_points is not None:
        crit.max_points = data.max_points
    if hasattr(data, "order_index") and data.order_index is not None:
        crit.order_index = data.order_index

    audit = AuditLog(
        user_id=actor_id,
        action="RUBRIC_CRITERION_UPDATED",
        entity_type="rubric_criterion",
        entity_id=str(crit.id),
        details={"assignment_id": assignment_id, "title": crit.title, "max_points": crit.max_points}
    )
    session.add(audit)
    session.flush()
    return crit

def delete_rubric_criterion(
    session: Session,
    assignment_id: int,
    criterion_id: int,
    actor_id: int
) -> bool:
    _check_evaluations_started(session, assignment_id)

    stmt = select(RubricCriterion).where(RubricCriterion.id == criterion_id)
    crit = session.execute(stmt).scalar_one_or_none()
    if not crit:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Rubrika mezoni topilmadi")

    audit = AuditLog(
        user_id=actor_id,
        action="RUBRIC_CRITERION_DELETED",
        entity_type="rubric_criterion",
        entity_id=str(crit.id),
        details={"assignment_id": assignment_id, "title": crit.title}
    )
    session.add(audit)

    session.delete(crit)
    session.flush()
    return True
