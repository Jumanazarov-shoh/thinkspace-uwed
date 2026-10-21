"""
Multi-Admin Evaluation and Rubric Scoring Service.
Handles rubric evaluations, multiple evaluators, score discrepancy detection, and revision requests.
"""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.assignment import Assignment, RubricCriterion
from app.models.submission import Submission, SubmissionStatus
from app.models.evaluation import Evaluation, CriterionScore, EvaluationStatus
from app.schemas.evaluation import EvaluationCreate

def evaluate_submission(
    session: Session,
    data: EvaluationCreate,
    evaluator_id: int
) -> Evaluation:
    stmt = select(Submission).where(Submission.id == data.submission_id)
    result = session.execute(stmt)
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Topshirilgan ish topilmadi (Submission not found)")

    assignment = submission.assignment
    active_rubric = assignment.active_rubric
    if not active_rubric:
        raise HTTPException(status_code=400, detail="Ushbu topshiriq uchun baholash rubrikasi mavjud emas (No active rubric)")

    version_id = submission.current_version_id
    if not version_id:
        raise HTTPException(status_code=400, detail="Topshirilgan ishning versiyasi topilmadi")

    eval_stmt = select(Evaluation).where(
        Evaluation.submission_id == submission.id,
        Evaluation.submission_version_id == version_id,
        Evaluation.evaluator_id == evaluator_id
    )
    eval_res = session.execute(eval_stmt)
    evaluation = eval_res.scalar_one_or_none()

    criteria_map = {c.id: c for c in active_rubric.criteria}
    total_score = 0.0

    if not data.is_draft and not data.is_revision_requested:
        scored_ids = {cs.criterion_id for cs in data.criterion_scores}
        missing_ids = set(criteria_map.keys()) - scored_ids
        if missing_ids:
            missing_names = [criteria_map[cid].title for cid in missing_ids]
            raise HTTPException(
                status_code=400,
                detail=f"Barcha mezonlar baholanishi shart. Baholanmagan: {', '.join(missing_names)}"
            )

    for cs in data.criterion_scores:
        if cs.criterion_id not in criteria_map:
            raise HTTPException(status_code=400, detail=f"Noto'g'ri mezon ID: {cs.criterion_id}")
        crit = criteria_map[cs.criterion_id]
        if cs.score < 0 or cs.score > crit.max_points:
            raise HTTPException(
                status_code=400,
                detail=f"'{crit.title}' mezoni bo'yicha ball 0 dan {crit.max_points} gacha bo'lishi shart. Kiritildi: {cs.score}"
            )
        total_score += cs.score

    if not evaluation:
        evaluation = Evaluation(
            submission_id=submission.id,
            submission_version_id=version_id,
            evaluator_id=evaluator_id,
            status=EvaluationStatus.DRAFT.value if data.is_draft else EvaluationStatus.SUBMITTED.value,
            total_score=total_score,
            general_feedback=data.general_feedback,
            is_revision_requested=data.is_revision_requested,
            revision_notes=data.revision_notes,
            submitted_at=None if data.is_draft else datetime.now(timezone.utc)
        )
        session.add(evaluation)
        session.flush()
    else:
        evaluation.status = EvaluationStatus.DRAFT.value if data.is_draft else EvaluationStatus.SUBMITTED.value
        evaluation.total_score = total_score
        evaluation.general_feedback = data.general_feedback
        evaluation.is_revision_requested = data.is_revision_requested
        evaluation.revision_notes = data.revision_notes
        if not data.is_draft:
            evaluation.submitted_at = datetime.now(timezone.utc)

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

    if data.is_revision_requested:
        submission.status = SubmissionStatus.REVISION_REQUESTED.value
    elif not data.is_draft:
        all_evals_stmt = select(Evaluation).where(
            Evaluation.submission_id == submission.id,
            Evaluation.submission_version_id == version_id,
            Evaluation.status == EvaluationStatus.SUBMITTED.value
        )
        all_evals_res = session.execute(all_evals_stmt)
        submitted_evals = list(all_evals_res.scalars().all())

        if len(submitted_evals) < assignment.min_evaluators:
            submission.status = SubmissionStatus.UNDER_REVIEW.value
        else:
            scores = [e.total_score for e in submitted_evals]
            max_diff = max(scores) - min(scores)
            percentage_diff = (max_diff / assignment.max_score) * 100.0 if assignment.max_score > 0 else 0

            if percentage_diff > assignment.discrepancy_threshold:
                submission.status = SubmissionStatus.AWAITING_MODERATOR.value
            elif assignment.requires_moderation:
                submission.status = SubmissionStatus.AWAITING_MODERATOR.value
            else:
                submission.status = SubmissionStatus.APPROVED.value

    session.flush()
    return evaluation

def get_evaluations_for_submission(
    session: Session,
    submission_id: int
) -> List[Evaluation]:
    stmt = select(Evaluation).where(Evaluation.submission_id == submission_id)
    result = session.execute(stmt)
    return list(result.scalars().all())
