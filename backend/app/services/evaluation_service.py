"""
Multi-Admin Evaluation, Rubric Scoring, Senior Review, and Moderation Service.
Handles:
- Reusable rubric-based grading
- Multiple evaluator assignments and conflict-of-interest prevention
- Evaluator review queue and draft evaluations
- Multi-evaluator score averaging and 15% discrepancy detection
- Senior Reviewer queue and escalation
- Moderator authoritative final decision and grade publishing
- Strict privacy: member visibility restricted to finalized results
"""
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import HTTPException
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from app.models.assignment import Assignment, Rubric, RubricCriterion
from app.models.submission import Submission, SubmissionStatus
from app.models.evaluation import (
    Evaluation,
    CriterionScore,
    EvaluationStatus,
    ReviewStatus,
    EvaluatorAssignment,
    SeniorReview,
    ModeratorDecision,
    ModeratorDecisionType,
    PublishedGrade
)
from app.models.user import User, RoleEnum
from app.models.audit import AuditLog
from app.schemas.evaluation import EvaluationCreate, SeniorReviewCreate
from app.services.notification_service import notify_evaluation_finalized

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

# ---------------------------------------------------------------------------
# Evaluator Assignment Management
# ---------------------------------------------------------------------------

def assign_evaluator(
    session: Session,
    submission_id: int,
    evaluator_id: int,
    assigned_by_user: User
) -> EvaluatorAssignment:
    submission = session.execute(select(Submission).where(Submission.id == submission_id)).scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Topshirilgan ish topilmadi")

    # Conflict of interest check: an evaluator must not evaluate their own submission
    if submission.user_id == evaluator_id:
        raise HTTPException(status_code=400, detail="Baholovchi o'z topshirig'ini o'zi baholashi taqiqlanadi (Conflict of interest)")

    # Verify evaluator exists and has evaluator/admin role
    evaluator = session.execute(select(User).where(User.id == evaluator_id)).scalar_one_or_none()
    if not evaluator:
        raise HTTPException(status_code=404, detail="Baholovchi foydalanuvchi topilmadi")

    is_evaluator = (
        evaluator.has_role(RoleEnum.EVALUATOR.value) or
        evaluator.has_role(RoleEnum.SENIOR_REVIEWER.value) or
        evaluator.has_role(RoleEnum.MODERATOR.value) or
        evaluator.has_role(RoleEnum.SUPER_ADMIN.value)
    )
    if not is_evaluator:
        raise HTTPException(status_code=400, detail="Foydalanuvchi baholovchi (Evaluator) huquqiga ega emas")

    # Duplicate assignment check
    existing_stmt = select(EvaluatorAssignment).where(
        EvaluatorAssignment.submission_id == submission_id,
        EvaluatorAssignment.evaluator_id == evaluator_id
    )
    if session.execute(existing_stmt).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ushbu baholovchi allaqachon ushbu topshiriqqa biriktirilgan")

    assignment = EvaluatorAssignment(
        submission_id=submission_id,
        evaluator_id=evaluator_id,
        assigned_by_id=assigned_by_user.id,
        status="assigned",
        assigned_at=utc_now(),
        updated_at=utc_now()
    )
    session.add(assignment)

    if submission.review_status == ReviewStatus.AWAITING_EVALUATION.value:
        submission.review_status = ReviewStatus.UNDER_EVALUATION.value

    session.add(AuditLog(
        user_id=assigned_by_user.id,
        action="evaluator_assigned",
        entity_type="evaluator_assignment",
        entity_id=str(submission_id),
        details={"evaluator_id": evaluator_id, "submission_id": submission_id}
    ))

    session.flush()
    return assignment

def remove_evaluator(
    session: Session,
    submission_id: int,
    evaluator_id: int,
    removed_by_user: User
) -> bool:
    stmt = select(EvaluatorAssignment).where(
        EvaluatorAssignment.submission_id == submission_id,
        EvaluatorAssignment.evaluator_id == evaluator_id
    )
    assignment = session.execute(stmt).scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Biriktirilgan baholovchi topilmadi")

    # Check if this evaluator has already submitted an evaluation
    eval_stmt = select(Evaluation).where(
        Evaluation.submission_id == submission_id,
        Evaluation.evaluator_id == evaluator_id,
        Evaluation.status == EvaluationStatus.SUBMITTED.value
    )
    if session.execute(eval_stmt).scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Ushbu baholovchi allaqachon rasmiy baho topshirgan. Tarixiy ma'lumotlarni o'chirish taqiqlanadi."
        )

    session.add(AuditLog(
        user_id=removed_by_user.id,
        action="evaluator_removed",
        entity_type="evaluator_assignment",
        entity_id=str(submission_id),
        details={"evaluator_id": evaluator_id, "submission_id": submission_id}
    ))

    session.delete(assignment)
    session.flush()
    return True

def list_evaluator_assigned_submissions(
    session: Session,
    evaluator_id: int,
    status_filter: Optional[str] = None
) -> List[Dict[str, Any]]:
    """List submissions assigned to a specific evaluator."""
    stmt = (
        select(EvaluatorAssignment, Submission)
        .join(Submission, EvaluatorAssignment.submission_id == Submission.id)
        .where(EvaluatorAssignment.evaluator_id == evaluator_id)
        .order_by(EvaluatorAssignment.assigned_at.desc())
    )
    results = session.execute(stmt).all()

    items = []
    for ea, sub in results:
        # Check evaluator's evaluation for this submission
        user_eval = session.execute(
            select(Evaluation).where(
                Evaluation.submission_id == sub.id,
                Evaluation.evaluator_id == evaluator_id
            )
        ).scalar_one_or_none()

        eval_status = "pending"
        eval_score = None
        if user_eval:
            eval_status = user_eval.status
            eval_score = user_eval.total_score

        if status_filter:
            if status_filter == "pending" and eval_status != "pending":
                continue
            if status_filter == "in_progress" and eval_status != "draft":
                continue
            if status_filter == "completed" and eval_status != "submitted":
                continue

        assign = sub.assignment
        member = sub.user
        member_name = member.display_name or f"{member.first_name} {member.last_name or ''}".strip() or member.username

        latest_v = sub.latest_version
        items.append({
            "assignment_id": assign.id,
            "assignment_title": assign.title,
            "direction": assign.direction,
            "max_score": assign.max_score,
            "submission_id": sub.id,
            "member_id": sub.user_id,
            "member_name": member_name,
            "submitted_at": sub.submitted_at,
            "is_late": sub.is_late,
            "submission_status": sub.status,
            "review_status": sub.review_status,
            "evaluator_assignment_status": ea.status,
            "evaluation_status": eval_status,
            "evaluation_score": eval_score,
            "text_content": latest_v.text_content if latest_v else None,
            "link_url": latest_v.link_url if latest_v else None,
            "attachments_count": len(latest_v.files) if latest_v else 0,
        })
    return items

# ---------------------------------------------------------------------------
# Rubric Scoring & Evaluation Workflow
# ---------------------------------------------------------------------------

def evaluate_submission(
    session: Session,
    data: EvaluationCreate,
    evaluator_id: int
) -> Evaluation:
    stmt = select(Submission).where(Submission.id == data.submission_id)
    result = session.execute(stmt)
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Topshirilgan ish topilmadi")

    # Conflict of interest check
    if submission.user_id == evaluator_id:
        raise HTTPException(status_code=400, detail="O'z topshirig'ingizni baholay olmaysiz")

    assignment = submission.assignment
    active_rubric = assignment.active_rubric
    if not active_rubric:
        raise HTTPException(status_code=400, detail="Ushbu topshiriq uchun baholash rubrikasi mavjud emas")

    version_id = submission.current_version_id
    if not version_id:
        raise HTTPException(status_code=400, detail="Topshirilgan ishning versiyasi topilmadi")

    # Verify existing evaluation
    eval_stmt = select(Evaluation).where(
        Evaluation.submission_id == submission.id,
        Evaluation.submission_version_id == version_id,
        Evaluation.evaluator_id == evaluator_id
    )
    evaluation = session.execute(eval_stmt).scalar_one_or_none()

    criteria_map = {c.id: c for c in active_rubric.criteria}
    total_score = 0.0

    # If submitting final evaluation (not draft), all criteria must be scored
    if not data.is_draft and not data.is_revision_requested:
        scored_ids = {cs.criterion_id for cs in data.criterion_scores}
        missing_ids = set(criteria_map.keys()) - scored_ids
        if missing_ids:
            missing_names = [criteria_map[cid].title for cid in missing_ids]
            raise HTTPException(
                status_code=400,
                detail=f"Barcha mezonlar baholanishi shart. Baholanmagan: {', '.join(missing_names)}"
            )

    # Validate each criterion score (0 <= score <= max_points)
    for cs in data.criterion_scores:
        if cs.criterion_id not in criteria_map:
            raise HTTPException(status_code=400, detail=f"Noto'g'ri mezon ID: {cs.criterion_id}")
        crit = criteria_map[cs.criterion_id]
        if cs.score < 0:
            raise HTTPException(status_code=400, detail=f"'{crit.title}' mezoni bo'yicha ball manfiy bo'lishi mumkin emas")
        if cs.score > crit.max_points:
            raise HTTPException(
                status_code=400,
                detail=f"'{crit.title}' mezoni bo'yicha maksimal ball: {crit.max_points}. Kiritildi: {cs.score}"
            )
        total_score += cs.score

    total_score = round(total_score, 2)

    if not evaluation:
        evaluation = Evaluation(
            submission_id=submission.id,
            submission_version_id=version_id,
            evaluator_id=evaluator_id,
            status=EvaluationStatus.DRAFT.value if data.is_draft else EvaluationStatus.SUBMITTED.value,
            total_score=total_score,
            general_feedback=data.general_feedback,
            internal_notes=data.internal_notes,
            is_revision_requested=data.is_revision_requested,
            revision_notes=data.revision_notes,
            created_at=utc_now(),
            submitted_at=None if data.is_draft else utc_now()
        )
        session.add(evaluation)
        session.flush()
    else:
        evaluation.status = EvaluationStatus.DRAFT.value if data.is_draft else EvaluationStatus.SUBMITTED.value
        evaluation.total_score = total_score
        evaluation.general_feedback = data.general_feedback
        evaluation.internal_notes = data.internal_notes
        evaluation.is_revision_requested = data.is_revision_requested
        evaluation.revision_notes = data.revision_notes
        if not data.is_draft:
            evaluation.submitted_at = utc_now()

        for old_cs in list(evaluation.criterion_scores):
            session.delete(old_cs)
        session.flush()

    for cs in data.criterion_scores:
        session.add(CriterionScore(
            evaluation_id=evaluation.id,
            criterion_id=cs.criterion_id,
            score=cs.score,
            comment=cs.comment
        ))

    session.flush()

    # Update EvaluatorAssignment status
    ea_stmt = select(EvaluatorAssignment).where(
        EvaluatorAssignment.submission_id == submission.id,
        EvaluatorAssignment.evaluator_id == evaluator_id
    )
    ea = session.execute(ea_stmt).scalar_one_or_none()
    if ea:
        ea.status = "in_progress" if data.is_draft else "completed"
        ea.updated_at = utc_now()

    # Audit log
    action_name = "evaluation_draft_saved" if data.is_draft else "evaluation_submitted"
    session.add(AuditLog(
        user_id=evaluator_id,
        action=action_name,
        entity_type="evaluation",
        entity_id=str(evaluation.id),
        details={"submission_id": submission.id, "total_score": total_score, "is_draft": data.is_draft}
    ))

    # Review status calculations when an evaluation is officially submitted
    if data.is_revision_requested:
        submission.status = SubmissionStatus.REVISION_REQUESTED.value
    elif not data.is_draft:
        all_evals_stmt = select(Evaluation).where(
            Evaluation.submission_id == submission.id,
            Evaluation.submission_version_id == version_id,
            Evaluation.status == EvaluationStatus.SUBMITTED.value
        )
        submitted_evals = list(session.execute(all_evals_stmt).scalars().all())

        if len(submitted_evals) < assignment.min_evaluators:
            submission.review_status = ReviewStatus.UNDER_EVALUATION.value
            submission.status = SubmissionStatus.UNDER_REVIEW.value
        else:
            scores = [e.total_score for e in submitted_evals]
            max_diff = max(scores) - min(scores)
            max_score = assignment.max_score or 100
            diff_pct = (max_diff / max_score) * 100.0 if max_score > 0 else 0

            threshold = assignment.discrepancy_threshold or 15.0

            if diff_pct > threshold:
                submission.review_status = ReviewStatus.NEEDS_REVIEW.value
                submission.status = SubmissionStatus.AWAITING_MODERATOR.value
                session.add(AuditLog(
                    user_id=evaluator_id,
                    action="submission_flagged_for_review",
                    entity_type="submission",
                    entity_id=str(submission.id),
                    details={
                        "scores": scores,
                        "difference": max_diff,
                        "difference_percentage": diff_pct,
                        "threshold": threshold
                    }
                ))
            elif assignment.requires_moderation:
                submission.review_status = ReviewStatus.MODERATOR_REVIEW.value
                submission.status = SubmissionStatus.AWAITING_MODERATOR.value
            else:
                submission.review_status = ReviewStatus.EVALUATION_COMPLETE.value
                submission.status = SubmissionStatus.APPROVED.value

    session.flush()
    return evaluation

def get_submission_evaluation_context(
    session: Session,
    submission_id: int,
    viewer_user: User
) -> Dict[str, Any]:
    """Retrieve full context for evaluation: assignment, rubric, submission version, files, and existing evaluations."""
    stmt = select(Submission).where(Submission.id == submission_id)
    submission = session.execute(stmt).scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Topshirilgan ish topilmadi")

    assignment = submission.assignment
    active_rubric = assignment.active_rubric
    latest_v = submission.latest_version
    member = submission.user
    member_name = member.display_name or f"{member.first_name} {member.last_name or ''}".strip() or member.username

    # Existing evaluations (filtered based on viewer role)
    is_staff = (
        viewer_user.has_role(RoleEnum.SENIOR_REVIEWER.value) or
        viewer_user.has_role(RoleEnum.MODERATOR.value) or
        viewer_user.has_role(RoleEnum.SUPER_ADMIN.value)
    )

    all_evals = session.execute(
        select(Evaluation).where(Evaluation.submission_id == submission_id)
    ).scalars().all()

    eval_data = []
    for e in all_evals:
        # Ordinary evaluator can only see their own evaluation
        if not is_staff and e.evaluator_id != viewer_user.id:
            continue
        eval_data.append({
            "id": e.id,
            "evaluator_id": e.evaluator_id,
            "evaluator_name": e.evaluator.display_name or e.evaluator.username if e.evaluator else f"Evaluator #{e.evaluator_id}",
            "status": e.status,
            "total_score": e.total_score,
            "general_feedback": e.general_feedback,
            "internal_notes": e.internal_notes if is_staff or e.evaluator_id == viewer_user.id else None,
            "submitted_at": e.submitted_at,
            "criterion_scores": [
                {"criterion_id": cs.criterion_id, "score": cs.score, "comment": cs.comment}
                for cs in e.criterion_scores
            ]
        })

    # Senior reviews
    senior_reviews = []
    if is_staff:
        sr_list = session.execute(
            select(SeniorReview).where(SeniorReview.submission_id == submission_id)
        ).scalars().all()
        for sr in sr_list:
            senior_reviews.append({
                "id": sr.id,
                "senior_reviewer_id": sr.senior_reviewer_id,
                "senior_reviewer_name": sr.senior_reviewer.display_name or sr.senior_reviewer.username if sr.senior_reviewer else f"Senior Reviewer #{sr.senior_reviewer_id}",
                "recommended_score": sr.recommended_score,
                "rationale": sr.rationale,
                "internal_notes": sr.internal_notes,
                "escalate_to_moderator": sr.escalate_to_moderator,
                "created_at": sr.created_at
            })

    # Assigned evaluators
    assignments = session.execute(
        select(EvaluatorAssignment).where(EvaluatorAssignment.submission_id == submission_id)
    ).scalars().all()
    assigned_list = [
        {
            "id": ea.id,
            "evaluator_id": ea.evaluator_id,
            "evaluator_name": ea.evaluator.display_name or ea.evaluator.username if ea.evaluator else f"Evaluator #{ea.evaluator_id}",
            "status": ea.status,
            "assigned_at": ea.assigned_at
        }
        for ea in assignments
    ]

    return {
        "submission_id": submission.id,
        "assignment_id": assignment.id,
        "assignment_title": assignment.title,
        "direction": assignment.direction,
        "instructions": assignment.instructions,
        "max_score": assignment.max_score,
        "discrepancy_threshold": assignment.discrepancy_threshold,
        "member_id": submission.user_id,
        "member_name": member_name,
        "submission_status": submission.status,
        "review_status": submission.review_status,
        "submitted_at": submission.submitted_at,
        "is_late": submission.is_late,
        "text_content": latest_v.text_content if latest_v else "",
        "link_url": latest_v.link_url if latest_v else None,
        "files": [
            {
                "id": f.id,
                "filename": f.original_filename,
                "size_bytes": f.file_size_bytes,
                "download_url": f"/api/submissions/files/{f.id}/download"
            }
            for f in (latest_v.files if latest_v else [])
        ],
        "rubric": {
            "id": active_rubric.id if active_rubric else None,
            "criteria": [
                {
                    "id": c.id,
                    "title": c.title,
                    "description": c.description,
                    "guidance": c.guidance,
                    "max_points": c.max_points,
                    "order_index": c.order_index
                }
                for c in (active_rubric.criteria if active_rubric else [])
            ]
        },
        "assigned_evaluators": assigned_list,
        "evaluations": eval_data,
        "senior_reviews": senior_reviews
    }

# ---------------------------------------------------------------------------
# Senior Reviewer Workflow
# ---------------------------------------------------------------------------

def list_senior_review_queue(session: Session) -> List[Dict[str, Any]]:
    """List submissions requiring Senior Reviewer attention."""
    stmt = (
        select(Submission)
        .where(Submission.review_status.in_([
            ReviewStatus.NEEDS_REVIEW.value,
            ReviewStatus.SENIOR_REVIEW.value
        ]))
        .order_by(Submission.submitted_at.desc())
    )
    submissions = list(session.execute(stmt).scalars().all())

    items = []
    for sub in submissions:
        assign = sub.assignment
        member = sub.user
        member_name = member.display_name or f"{member.first_name} {member.last_name or ''}".strip() or member.username

        submitted_evals = session.execute(
            select(Evaluation).where(
                Evaluation.submission_id == sub.id,
                Evaluation.status == EvaluationStatus.SUBMITTED.value
            )
        ).scalars().all()

        scores = [e.total_score for e in submitted_evals]
        diff = max(scores) - min(scores) if scores else 0
        avg = round(sum(scores) / len(scores), 2) if scores else 0

        items.append({
            "submission_id": sub.id,
            "assignment_id": assign.id,
            "assignment_title": assign.title,
            "direction": assign.direction,
            "member_name": member_name,
            "review_status": sub.review_status,
            "submitted_at": sub.submitted_at,
            "evaluators_count": len(submitted_evals),
            "scores": scores,
            "average_score": avg,
            "score_difference": diff,
            "max_score": assign.max_score
        })
    return items

def submit_senior_review(
    session: Session,
    submission_id: int,
    reviewer_user: User,
    data: SeniorReviewCreate
) -> SeniorReview:
    submission = session.execute(select(Submission).where(Submission.id == submission_id)).scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Topshirilgan ish topilmadi")

    assignment = submission.assignment
    if data.recommended_score < 0 or data.recommended_score > assignment.max_score:
        raise HTTPException(
            status_code=400,
            detail=f"Tavsiya etilgan ball 0 dan {assignment.max_score} gacha bo'lishi shart."
        )

    review = SeniorReview(
        submission_id=submission_id,
        senior_reviewer_id=reviewer_user.id,
        recommended_score=round(data.recommended_score, 2),
        rationale=data.rationale,
        internal_notes=data.internal_notes,
        escalate_to_moderator=data.escalate_to_moderator,
        created_at=utc_now()
    )
    session.add(review)

    if data.escalate_to_moderator:
        submission.review_status = ReviewStatus.MODERATOR_REVIEW.value
        action = "senior_review_escalated_to_moderator"
    else:
        submission.review_status = ReviewStatus.EVALUATION_COMPLETE.value
        action = "senior_review_completed"

    session.add(AuditLog(
        user_id=reviewer_user.id,
        action=action,
        entity_type="senior_review",
        entity_id=str(submission.id),
        details={
            "recommended_score": data.recommended_score,
            "escalated": data.escalate_to_moderator,
            "rationale": data.rationale
        }
    ))

    session.flush()
    return review

# ---------------------------------------------------------------------------
# Moderator Final Decision & Grade Finalization
# ---------------------------------------------------------------------------

def list_moderator_queue(session: Session) -> List[Dict[str, Any]]:
    """List submissions requiring Moderator final decision."""
    stmt = (
        select(Submission)
        .where(Submission.review_status.in_([
            ReviewStatus.MODERATOR_REVIEW.value,
            ReviewStatus.NEEDS_REVIEW.value,
            ReviewStatus.EVALUATION_COMPLETE.value
        ]))
        .order_by(Submission.submitted_at.desc())
    )
    submissions = list(session.execute(stmt).scalars().all())

    items = []
    for sub in submissions:
        assign = sub.assignment
        member = sub.user
        member_name = member.display_name or f"{member.first_name} {member.last_name or ''}".strip() or member.username

        submitted_evals = session.execute(
            select(Evaluation).where(
                Evaluation.submission_id == sub.id,
                Evaluation.status == EvaluationStatus.SUBMITTED.value
            )
        ).scalars().all()

        scores = [e.total_score for e in submitted_evals]
        diff = max(scores) - min(scores) if scores else 0
        avg = round(sum(scores) / len(scores), 2) if scores else 0

        # Check senior review
        last_sr = session.execute(
            select(SeniorReview).where(SeniorReview.submission_id == sub.id).order_by(SeniorReview.created_at.desc())
        ).scalars().first()

        items.append({
            "submission_id": sub.id,
            "assignment_id": assign.id,
            "assignment_title": assign.title,
            "direction": assign.direction,
            "member_name": member_name,
            "review_status": sub.review_status,
            "submitted_at": sub.submitted_at,
            "evaluators_count": len(submitted_evals),
            "scores": scores,
            "average_score": avg,
            "score_difference": diff,
            "senior_recommendation": last_sr.recommended_score if last_sr else None,
            "max_score": assign.max_score
        })
    return items

def finalize_evaluation(
    session: Session,
    submission_id: int,
    moderator_user: User,
    final_score: float,
    rationale: str
) -> PublishedGrade:
    """Authoritative moderator decision and final grade publishing."""
    submission = session.execute(select(Submission).where(Submission.id == submission_id)).scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Topshirilgan ish topilmadi")

    assignment = submission.assignment
    if final_score < 0 or final_score > assignment.max_score:
        raise HTTPException(
            status_code=400,
            detail=f"Yakuniy ball 0 dan {assignment.max_score} gacha bo'lishi shart."
        )

    # Record ModeratorDecision
    decision = ModeratorDecision(
        submission_id=submission.id,
        moderator_id=moderator_user.id,
        decision=ModeratorDecisionType.APPROVED.value,
        override_score=final_score,
        rationale=rationale,
        created_at=utc_now()
    )
    session.add(decision)

    max_score = float(assignment.max_score)
    percentage = round((final_score / max_score) * 100.0, 2) if max_score > 0 else 0.0

    # Create or update PublishedGrade
    published_grade = submission.published_grade
    is_existing = published_grade is not None
    previous_score = published_grade.final_score if is_existing else 0.0

    if not published_grade:
        published_grade = PublishedGrade(
            submission_id=submission.id,
            assignment_id=assignment.id,
            user_id=submission.user_id,
            final_score=round(final_score, 2),
            max_score=max_score,
            percentage=percentage,
            overall_feedback=f"Rasmiy xulosa: {rationale}",
            published_by_id=moderator_user.id,
            published_at=utc_now()
        )
        session.add(published_grade)
    else:
        published_grade.final_score = round(final_score, 2)
        published_grade.max_score = max_score
        published_grade.percentage = percentage
        published_grade.overall_feedback = f"Rasmiy xulosa: {rationale}"
        published_grade.published_by_id = moderator_user.id
        published_grade.published_at = utc_now()

    submission.review_status = ReviewStatus.FINALIZED.value
    submission.status = SubmissionStatus.PUBLISHED.value

    session.add(AuditLog(
        user_id=moderator_user.id,
        action="evaluation_finalized",
        entity_type="published_grade",
        entity_id=str(submission.id),
        details={"final_score": final_score, "percentage": percentage, "rationale": rationale}
    ))

    session.flush()

    # Milestone 7: Award or correct transparent points in ledger
    try:
        from app.services.points_service import award_assignment_points, record_score_correction
        if not is_existing:
            award_assignment_points(session, submission, assignment, published_grade)
        elif previous_score != final_score:
            record_score_correction(session, published_grade, previous_score, final_score, rationale, moderator_user.id)
    except Exception as e:
        import logging
        logging.getLogger("thinkspace.evaluations").warning(f"Points award notice in finalize_evaluation: {e}")

    try:
        notify_evaluation_finalized(
            session=session,
            submission=submission,
            assignment=assignment,
            final_score=final_score,
            overall_feedback=rationale
        )
    except Exception:
        pass

    return published_grade

# ---------------------------------------------------------------------------
# Admin Submissions & Evaluations Overview
# ---------------------------------------------------------------------------

def list_evaluations_admin_overview(
    session: Session,
    review_status_filter: Optional[str] = None,
    direction_filter: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Administrative overview of all submissions and their multi-evaluator review statuses."""
    stmt = (
        select(Submission)
        .where(Submission.status != SubmissionStatus.DRAFT.value)
        .order_by(Submission.submitted_at.desc())
    )
    submissions = list(session.execute(stmt).scalars().all())

    items = []
    for sub in submissions:
        assign = sub.assignment
        if direction_filter and assign.direction.lower() != direction_filter.lower():
            continue
        if review_status_filter and sub.review_status != review_status_filter:
            continue

        member = sub.user
        member_name = member.display_name or f"{member.first_name} {member.last_name or ''}".strip() or member.username

        # Assigned evaluators
        assignments = session.execute(
            select(EvaluatorAssignment).where(EvaluatorAssignment.submission_id == sub.id)
        ).scalars().all()
        assigned_list = [
            {
                "id": ea.id,
                "evaluator_id": ea.evaluator_id,
                "evaluator_name": ea.evaluator.display_name or ea.evaluator.username if ea.evaluator else f"Evaluator #{ea.evaluator_id}",
                "status": ea.status
            }
            for ea in assignments
        ]

        # Submitted evaluations
        evals = session.execute(
            select(Evaluation).where(
                Evaluation.submission_id == sub.id,
                Evaluation.status == EvaluationStatus.SUBMITTED.value
            )
        ).scalars().all()

        scores = [e.total_score for e in evals]
        eval_list = [
            {
                "id": e.id,
                "evaluator_id": e.evaluator_id,
                "evaluator_name": e.evaluator.display_name or e.evaluator.username if e.evaluator else f"Evaluator #{e.evaluator_id}",
                "total_score": e.total_score
            }
            for e in evals
        ]

        average_score = round(sum(scores) / len(scores), 2) if scores else None
        score_diff = round(max(scores) - min(scores), 2) if len(scores) >= 2 else None
        max_score = assign.max_score or 100
        diff_pct = round((score_diff / max_score) * 100.0, 2) if score_diff is not None and max_score > 0 else None
        is_discrepant = diff_pct is not None and diff_pct > (assign.discrepancy_threshold or 15.0)

        final_score = sub.published_grade.final_score if sub.published_grade else None

        items.append({
            "submission_id": sub.id,
            "assignment_id": assign.id,
            "assignment_title": assign.title,
            "direction": assign.direction,
            "member_name": member_name,
            "member_id": sub.user_id,
            "submitted_at": sub.submitted_at,
            "is_late": sub.is_late,
            "submission_status": sub.status,
            "review_status": sub.review_status,
            "max_score": assign.max_score,
            "assigned_evaluators": assigned_list,
            "evaluations_count": len(evals),
            "evaluations": eval_list,
            "average_score": average_score,
            "score_difference": score_diff,
            "difference_percentage": diff_pct,
            "is_discrepant": is_discrepant,
            "final_score": final_score
        })
    return items

# ---------------------------------------------------------------------------
# Member Results View (Strict Privacy)
# ---------------------------------------------------------------------------

def get_member_result(
    session: Session,
    assignment_id: int,
    user_id: int
) -> Dict[str, Any]:
    """
    Retrieve member's result for an assignment.
    Strict privacy: only finalized results and approved feedback are returned.
    Drafts, private evaluator identities, and internal notes are NEVER exposed.
    """
    submission = session.execute(
        select(Submission).where(
            Submission.assignment_id == assignment_id,
            Submission.user_id == user_id
        )
    ).scalar_one_or_none()

    assign = session.execute(select(Assignment).where(Assignment.id == assignment_id)).scalar_one_or_none()
    if not assign:
        raise HTTPException(status_code=404, detail="Topshiriq topilmadi")

    if not submission:
        return {
            "assignment_id": assign.id,
            "assignment_title": assign.title,
            "direction": assign.direction,
            "submission_id": None,
            "review_status": "not_submitted",
            "is_finalized": False,
            "final_score": None,
            "max_score": assign.max_score,
            "percentage": None,
            "overall_feedback": None,
            "finalized_at": None,
            "criteria_breakdown": []
        }

    is_finalized = (submission.review_status == ReviewStatus.FINALIZED.value) or (submission.published_grade is not None)

    if not is_finalized:
        return {
            "assignment_id": assign.id,
            "assignment_title": assign.title,
            "direction": assign.direction,
            "submission_id": submission.id,
            "review_status": "under_review",
            "is_finalized": False,
            "final_score": None,
            "max_score": assign.max_score,
            "percentage": None,
            "overall_feedback": None,
            "finalized_at": None,
            "criteria_breakdown": []
        }

    grade = submission.published_grade
    final_score = grade.final_score if grade else None
    max_score = grade.max_score if grade else float(assign.max_score)
    percentage = grade.percentage if grade else None
    feedback = grade.overall_feedback if grade else None
    finalized_at = grade.published_at if grade else None

    # Calculate criteria breakdown if available from active rubric
    active_rubric = assign.active_rubric
    breakdown = []
    if active_rubric:
        # Calculate average criterion score across submitted evaluations
        submitted_evals = [e for e in submission.evaluations if e.status == EvaluationStatus.SUBMITTED.value]
        for crit in active_rubric.criteria:
            scores_for_crit = []
            for ev in submitted_evals:
                cs = next((c for c in ev.criterion_scores if c.criterion_id == crit.id), None)
                if cs:
                    scores_for_crit.append(cs.score)
            crit_score = round(sum(scores_for_crit) / len(scores_for_crit), 2) if scores_for_crit else None
            breakdown.append({
                "criterion_id": crit.id,
                "title": crit.title,
                "max_points": crit.max_points,
                "score": crit_score
            })

    return {
        "assignment_id": assign.id,
        "assignment_title": assign.title,
        "direction": assign.direction,
        "submission_id": submission.id,
        "review_status": "finalized",
        "is_finalized": True,
        "final_score": final_score,
        "max_score": max_score,
        "percentage": percentage,
        "overall_feedback": feedback,
        "finalized_at": finalized_at,
        "criteria_breakdown": breakdown
    }

def get_evaluations_for_submission(
    session: Session,
    submission_id: int
) -> List[Evaluation]:
    stmt = select(Evaluation).where(Evaluation.submission_id == submission_id)
    return list(session.execute(stmt).scalars().all())
