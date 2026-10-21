"""
Submission API routes.
"""
import os
from typing import List, Optional
from fastapi import APIRouter, Depends, Form, File, UploadFile, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.deps import get_current_active_member, get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.submission import Submission, StoredFile
from app.schemas.submission import (
    SubmissionResponse,
    SubmissionDetailResponse,
)
from app.services.submission_service import (
    submit_work,
    get_submission_by_id,
    get_user_submission_for_assignment,
    list_submissions_for_admin,
)

router = APIRouter(prefix="/submissions", tags=["Submissions"])

@router.post("/assignment/{assignment_id}", response_model=SubmissionResponse)
async def submit_assignment_work(
    assignment_id: int,
    text_content: Optional[str] = Form(None),
    link_url: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    current_user: User = Depends(get_current_active_member),
    db: Session = Depends(get_db)
):
    submission = await submit_work(
        session=db,
        assignment_id=assignment_id,
        user_id=current_user.id,
        text_content=text_content,
        link_url=link_url,
        uploaded_files=files
    )
    db.commit()
    db.refresh(submission)
    return SubmissionResponse.model_validate(submission)

@router.get("/assignment/{assignment_id}/my-submission", response_model=Optional[SubmissionDetailResponse])
def get_my_submission_for_assignment(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sub = get_user_submission_for_assignment(db, assignment_id, current_user.id)
    if not sub:
        return None
    return SubmissionDetailResponse.model_validate(sub)

@router.get("", response_model=List[SubmissionResponse])
def get_submissions_list(
    assignment_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_roles([RoleEnum.EVALUATOR.value, RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    items = list_submissions_for_admin(db, assignment_id=assignment_id, status=status_filter)
    return [SubmissionResponse.model_validate(s) for s in items]

@router.get("/{submission_id}", response_model=SubmissionDetailResponse)
def get_submission_detail(
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sub = get_submission_by_id(db, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Topshirilgan ish topilmadi")

    is_staff = (
        current_user.has_role(RoleEnum.EVALUATOR.value) or
        current_user.has_role(RoleEnum.MODERATOR.value) or
        current_user.has_role(RoleEnum.SUPER_ADMIN.value)
    )
    if not is_staff and sub.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Boshqa a'zoning topshirig'ini ko'rishga ruxsat yo'q")

    return SubmissionDetailResponse.model_validate(sub)

@router.get("/files/{file_id}/download")
def download_submission_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    stmt = select(StoredFile).where(StoredFile.id == file_id)
    result = db.execute(stmt)
    stored_file = result.scalar_one_or_none()
    if not stored_file:
        raise HTTPException(status_code=404, detail="Fayl topilmadi")

    submission = stored_file.submission_version.submission
    is_staff = (
        current_user.has_role(RoleEnum.EVALUATOR.value) or
        current_user.has_role(RoleEnum.MODERATOR.value) or
        current_user.has_role(RoleEnum.SUPER_ADMIN.value)
    )
    if not is_staff and submission.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Ushbu faylni yuklab olishga ruxsat yo'q")

    if not os.path.exists(stored_file.storage_path):
        raise HTTPException(status_code=404, detail="Fayl server diskida topilmadi")

    return FileResponse(
        path=stored_file.storage_path,
        filename=stored_file.original_filename,
        media_type=stored_file.mime_type
    )
