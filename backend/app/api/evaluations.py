"""
Evaluation, Rubric Scoring, Senior Review, and Moderation API routes.
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.schemas.evaluation import (
    EvaluationCreate,
    EvaluationResponse,
    EvaluatorAssignmentCreate,
    EvaluatorAssignmentResponse,
    SeniorReviewCreate,
    SeniorReviewResponse,
    ModeratorFinalizeCreate,
    PublishedGradeResponse,
    SubmissionEvaluationOverviewItem,
    MemberResultResponse
)
from app.services.evaluation_service import (
    assign_evaluator,
    remove_evaluator,
    list_evaluator_assigned_submissions,
    evaluate_submission,
    get_submission_evaluation_context,
    list_senior_review_queue,
    submit_senior_review,
    list_moderator_queue,
    finalize_evaluation,
    list_evaluations_admin_overview,
    get_member_result,
    get_evaluations_for_submission
)
from app.services.submission_service import get_submission_by_id

router = APIRouter(prefix="/evaluations", tags=["Evaluations"])

EVALUATOR_ROLES = [
    RoleEnum.EVALUATOR.value,
    RoleEnum.SENIOR_REVIEWER.value,
    RoleEnum.MODERATOR.value,
    RoleEnum.SUPER_ADMIN.value
]

ADMIN_ROLES = [
    RoleEnum.MODERATOR.value,
    RoleEnum.SUPER_ADMIN.value
]

SENIOR_ROLES = [
    RoleEnum.SENIOR_REVIEWER.value,
    RoleEnum.MODERATOR.value,
    RoleEnum.SUPER_ADMIN.value
]

# ---------------------------------------------------------------------------
# Evaluator Review Queue & Submission
# ---------------------------------------------------------------------------

@router.get("/assigned", response_model=List[Dict[str, Any]])
def get_assigned_submissions(
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_roles(EVALUATOR_ROLES)),
    db: Session = Depends(get_db)
):
    """Retrieve submissions assigned to the authenticated evaluator."""
    return list_evaluator_assigned_submissions(db, evaluator_id=current_user.id, status_filter=status_filter)

@router.get("/submission/{submission_id}/context", response_model=Dict[str, Any])
def get_evaluation_context(
    submission_id: int,
    current_user: User = Depends(require_roles(EVALUATOR_ROLES)),
    db: Session = Depends(get_db)
):
    """Retrieve full evaluation context (deliverables, rubric, instructions, previous reviews)."""
    return get_submission_evaluation_context(db, submission_id=submission_id, viewer_user=current_user)

@router.post("", response_model=EvaluationResponse)
def submit_or_draft_evaluation(
    payload: EvaluationCreate,
    current_user: User = Depends(require_roles(EVALUATOR_ROLES)),
    db: Session = Depends(get_db)
):
    """Save an evaluation draft or submit a formal evaluation using the rubric."""
    evaluation = evaluate_submission(db, payload, evaluator_id=current_user.id)
    db.commit()
    db.refresh(evaluation)
    return EvaluationResponse.model_validate(evaluation)

# ---------------------------------------------------------------------------
# Evaluator Assignment Management (Admin / Super Admin)
# ---------------------------------------------------------------------------

@router.post("/assignments/{submission_id}/assign", response_model=EvaluatorAssignmentResponse)
def assign_evaluator_endpoint(
    submission_id: int,
    payload: EvaluatorAssignmentCreate,
    current_user: User = Depends(require_roles(ADMIN_ROLES)),
    db: Session = Depends(get_db)
):
    """Assign an evaluator to a submitted assignment."""
    ea = assign_evaluator(db, submission_id=submission_id, evaluator_id=payload.evaluator_id, assigned_by_user=current_user)
    db.commit()
    db.refresh(ea)
    return EvaluatorAssignmentResponse(
        id=ea.id,
        submission_id=ea.submission_id,
        evaluator_id=ea.evaluator_id,
        evaluator_name=ea.evaluator.display_name if ea.evaluator else None,
        evaluator_username=ea.evaluator.username if ea.evaluator else None,
        assigned_by_id=ea.assigned_by_id,
        status=ea.status,
        assigned_at=ea.assigned_at
    )

@router.delete("/assignments/{submission_id}/evaluators/{evaluator_id}")
def remove_evaluator_endpoint(
    submission_id: int,
    evaluator_id: int,
    current_user: User = Depends(require_roles(ADMIN_ROLES)),
    db: Session = Depends(get_db)
):
    """Remove an evaluator assignment before evaluation is completed."""
    remove_evaluator(db, submission_id=submission_id, evaluator_id=evaluator_id, removed_by_user=current_user)
    db.commit()
    return {"success": True, "message": "Baholovchi topshiriqdan olib tashlandi"}

# ---------------------------------------------------------------------------
# Senior Reviewer Workflow
# ---------------------------------------------------------------------------

@router.get("/senior-queue", response_model=List[Dict[str, Any]])
def get_senior_review_queue(
    current_user: User = Depends(require_roles(SENIOR_ROLES)),
    db: Session = Depends(get_db)
):
    """List submissions flagged for Senior Review or with score discrepancies."""
    return list_senior_review_queue(db)

@router.post("/submissions/{submission_id}/senior-review", response_model=SeniorReviewResponse)
def submit_senior_review_endpoint(
    submission_id: int,
    payload: SeniorReviewCreate,
    current_user: User = Depends(require_roles(SENIOR_ROLES)),
    db: Session = Depends(get_db)
):
    """Submit Senior Review recommendation or escalate to Moderator."""
    review = submit_senior_review(db, submission_id=submission_id, reviewer_user=current_user, data=payload)
    db.commit()
    db.refresh(review)
    return SeniorReviewResponse(
        id=review.id,
        submission_id=review.submission_id,
        senior_reviewer_id=review.senior_reviewer_id,
        senior_reviewer_name=review.senior_reviewer.display_name or review.senior_reviewer.username if review.senior_reviewer else None,
        recommended_score=review.recommended_score,
        rationale=review.rationale,
        internal_notes=review.internal_notes,
        escalate_to_moderator=review.escalate_to_moderator,
        created_at=review.created_at
    )

# ---------------------------------------------------------------------------
# Moderator Decision & Final Grade Publishing
# ---------------------------------------------------------------------------

@router.get("/moderator-queue", response_model=List[Dict[str, Any]])
def get_moderator_queue(
    current_user: User = Depends(require_roles(ADMIN_ROLES)),
    db: Session = Depends(get_db)
):
    """List submissions awaiting authoritative Moderator final decision."""
    return list_moderator_queue(db)

@router.post("/submissions/{submission_id}/finalize", response_model=PublishedGradeResponse)
def finalize_submission_grade(
    submission_id: int,
    payload: ModeratorFinalizeCreate,
    current_user: User = Depends(require_roles(ADMIN_ROLES)),
    db: Session = Depends(get_db)
):
    """Authoritatively finalize score, record official feedback, and publish grade."""
    grade = finalize_evaluation(
        session=db,
        submission_id=submission_id,
        moderator_user=current_user,
        final_score=payload.final_score,
        rationale=payload.rationale
    )
    db.commit()
    db.refresh(grade)
    return PublishedGradeResponse.model_validate(grade)

# ---------------------------------------------------------------------------
# Admin Submissions & Evaluations Overview
# ---------------------------------------------------------------------------

@router.get("/admin/overview", response_model=List[Dict[str, Any]])
def get_evaluations_admin_overview(
    review_status: Optional[str] = None,
    direction: Optional[str] = None,
    current_user: User = Depends(require_roles(EVALUATOR_ROLES)),
    db: Session = Depends(get_db)
):
    """Centralized admin overview of submissions, assigned evaluators, score discrepancy flags, and review statuses."""
    return list_evaluations_admin_overview(db, review_status_filter=review_status, direction_filter=direction)

# ---------------------------------------------------------------------------
# Member Results View (Strict Privacy)
# ---------------------------------------------------------------------------

@router.get("/member/assignment/{assignment_id}/result", response_model=MemberResultResponse)
def get_assignment_result_for_member(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve finalized score and feedback for the authenticated member.
    Hides private drafts, individual evaluator identities, and internal notes.
    """
    return get_member_result(db, assignment_id=assignment_id, user_id=current_user.id)

@router.get("/submission/{submission_id}", response_model=List[EvaluationResponse])
def list_evaluations_for_submission(
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sub = get_submission_by_id(db, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Topshirilgan ish topilmadi")

    is_staff = any(current_user.has_role(r) for r in EVALUATOR_ROLES)
    if not is_staff:
        if sub.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Ruxsat yo'q")
        if sub.status != "published":
            return []

    evals = get_evaluations_for_submission(db, submission_id)
    return [EvaluationResponse.model_validate(e) for e in evals]
