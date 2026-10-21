"""
Evaluation and Rubric Scoring API routes.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.schemas.evaluation import EvaluationCreate, EvaluationResponse
from app.services.evaluation_service import evaluate_submission, get_evaluations_for_submission
from app.services.submission_service import get_submission_by_id

router = APIRouter(prefix="/evaluations", tags=["Evaluations"])

@router.post("", response_model=EvaluationResponse)
def submit_evaluation(
    payload: EvaluationCreate,
    current_user: User = Depends(require_roles([RoleEnum.EVALUATOR.value, RoleEnum.SENIOR_REVIEWER.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    evaluation = evaluate_submission(db, payload, evaluator_id=current_user.id)
    db.commit()
    db.refresh(evaluation)
    return EvaluationResponse.model_validate(evaluation)

@router.get("/submission/{submission_id}", response_model=List[EvaluationResponse])
def list_evaluations_for_submission(
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sub = get_submission_by_id(db, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Topshirilgan ish topilmadi")

    is_staff = (
        current_user.has_role(RoleEnum.EVALUATOR.value) or
        current_user.has_role(RoleEnum.SENIOR_REVIEWER.value) or
        current_user.has_role(RoleEnum.MODERATOR.value) or
        current_user.has_role(RoleEnum.SUPER_ADMIN.value)
    )

    if not is_staff:
        if sub.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Ruxsat yo'q")
        if sub.status != "published":
            return []

    evals = get_evaluations_for_submission(db, submission_id)
    return [EvaluationResponse.model_validate(e) for e in evals]
