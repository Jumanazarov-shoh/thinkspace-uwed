"""
Submission API routes for ThinkSpace | UWED.
Endpoints for member draft saving, submission, resubmission,
file uploads, attachment deletions, and administrative overviews.
"""
import os
from typing import List, Optional
from fastapi import APIRouter, Depends, Form, File, UploadFile, HTTPException, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.deps import get_current_active_member, get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.submission import Submission, StoredFile
from app.schemas.submission import (
    SubmissionResponse,
    SubmissionDetailResponse,
    SubmissionVersionResponse,
    StoredFileResponse,
    MySubmissionSummary,
    AdminSubmissionOverviewItem,
)
from app.services.submission_service import (
    save_draft,
    submit_work,
    delete_submission_attachment,
    get_submission_by_id,
    get_user_submission_for_assignment,
    list_my_submissions,
    list_submissions_for_admin_overview,
    list_submissions_for_admin,
)
from app.services.storage_service import get_storage_provider

router = APIRouter(prefix="/submissions", tags=["Submissions"])

def _format_submission_detail(sub: Submission) -> SubmissionDetailResponse:
    versions_resp = []
    for v in sub.versions:
        files_resp = [
            StoredFileResponse(
                id=f.id,
                original_filename=f.original_filename,
                mime_type=f.mime_type,
                file_size_bytes=f.file_size_bytes,
                telegram_file_id=f.telegram_file_id,
                uploaded_at=f.uploaded_at,
                download_url=f"/api/submissions/files/{f.id}/download"
            )
            for f in v.files
        ]
        versions_resp.append(SubmissionVersionResponse(
            id=v.id,
            version_number=v.version_number,
            text_content=v.text_content,
            link_url=v.link_url,
            submitted_at=v.submitted_at,
            files=files_resp
        ))

    latest_resp = versions_resp[-1] if versions_resp else None

    return SubmissionDetailResponse(
        id=sub.id,
        assignment_id=sub.assignment_id,
        user_id=sub.user_id,
        status=sub.status,
        is_late=sub.is_late,
        submitted_at=sub.submitted_at,
        created_at=sub.created_at,
        updated_at=sub.updated_at,
        latest_version=latest_resp,
        versions=versions_resp
    )

@router.post("/assignment/{assignment_id}/draft", response_model=SubmissionDetailResponse)
async def save_assignment_draft(
    assignment_id: int,
    text_content: Optional[str] = Form(None),
    link_url: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    current_user: User = Depends(get_current_active_member),
    db: Session = Depends(get_db)
):
    submission = await save_draft(
        session=db,
        assignment_id=assignment_id,
        user_id=current_user.id,
        text_content=text_content,
        link_url=link_url,
        uploaded_files=files
    )
    db.commit()
    db.refresh(submission)
    return _format_submission_detail(submission)

@router.post("/assignment/{assignment_id}/submit", response_model=SubmissionDetailResponse)
async def submit_assignment(
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
    return _format_submission_detail(submission)

@router.post("/assignment/{assignment_id}", response_model=SubmissionDetailResponse)
async def submit_assignment_legacy(
    assignment_id: int,
    text_content: Optional[str] = Form(None),
    link_url: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    current_user: User = Depends(get_current_active_member),
    db: Session = Depends(get_db)
):
    """Backward compatible endpoint calling submit_work."""
    return await submit_assignment(
        assignment_id=assignment_id,
        text_content=text_content,
        link_url=link_url,
        files=files,
        current_user=current_user,
        db=db
    )

@router.get("/assignment/{assignment_id}/my-submission", response_model=Optional[SubmissionDetailResponse])
def get_my_submission_for_assignment(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sub = get_user_submission_for_assignment(db, assignment_id, current_user.id)
    if not sub:
        return None
    return _format_submission_detail(sub)

@router.get("/my-submissions", response_model=List[MySubmissionSummary])
def get_my_submissions(
    current_user: User = Depends(get_current_active_member),
    db: Session = Depends(get_db)
):
    return list_my_submissions(db, current_user.id)

@router.get("/admin/overview", response_model=List[AdminSubmissionOverviewItem])
def get_admin_submissions_overview(
    assignment_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_roles([RoleEnum.EVALUATOR.value, RoleEnum.SENIOR_REVIEWER.value, RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    return list_submissions_for_admin_overview(db, assignment_id=assignment_id, status_filter=status_filter)

@router.delete("/{submission_id}/attachments/{file_id}")
def delete_attachment(
    submission_id: int,
    file_id: int,
    current_user: User = Depends(get_current_active_member),
    db: Session = Depends(get_db)
):
    delete_submission_attachment(
        session=db,
        submission_id=submission_id,
        file_id=file_id,
        user_id=current_user.id
    )
    db.commit()
    return {"status": "success", "message": "Fayl muvaffaqiyatli o'chirildi"}

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
        current_user.has_role(RoleEnum.SENIOR_REVIEWER.value) or
        current_user.has_role(RoleEnum.MODERATOR.value) or
        current_user.has_role(RoleEnum.SUPER_ADMIN.value)
    )
    if not is_staff and sub.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Boshqa a'zoning topshirig'ini ko'rishga ruxsat yo'q")

    return _format_submission_detail(sub)

@router.get("/files/{file_id}/download")
def download_submission_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    stmt = (
        select(StoredFile, Submission)
        .join(Submission, StoredFile.submission_version_id == Submission.current_version_id)
        .where(StoredFile.id == file_id)
    )
    res = db.execute(stmt).first()
    if not res:
        # Fallback query across all versions
        from app.models.submission import SubmissionVersion
        stmt_all = (
            select(StoredFile, Submission)
            .join(SubmissionVersion, StoredFile.submission_version_id == SubmissionVersion.id)
            .join(Submission, SubmissionVersion.submission_id == Submission.id)
            .where(StoredFile.id == file_id)
        )
        res = db.execute(stmt_all).first()

    if not res:
        raise HTTPException(status_code=404, detail="Fayl topilmadi")

    stored_file, sub = res
    is_staff = (
        current_user.has_role(RoleEnum.EVALUATOR.value) or
        current_user.has_role(RoleEnum.SENIOR_REVIEWER.value) or
        current_user.has_role(RoleEnum.MODERATOR.value) or
        current_user.has_role(RoleEnum.SUPER_ADMIN.value)
    )
    if not is_staff and sub.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Faylni yuklab olishga ruxsat yo'q")

    storage = get_storage_provider()
    full_path = storage.get_file_path(stored_file.storage_path)
    if not full_path:
        raise HTTPException(status_code=404, detail="Fayl saqlash joyida topilmadi")

    if full_path.startswith("http://") or full_path.startswith("https://"):
        return RedirectResponse(url=full_path, status_code=307)

    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Fayl saqlash joyida topilmadi")

    return FileResponse(
        path=full_path,
        filename=stored_file.original_filename,
        media_type=stored_file.mime_type
    )

@router.get("", response_model=List[SubmissionResponse])
def get_submissions_list(
    assignment_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(require_roles([RoleEnum.EVALUATOR.value, RoleEnum.SENIOR_REVIEWER.value, RoleEnum.MODERATOR.value, RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    items = list_submissions_for_admin(db, assignment_id=assignment_id, status=status_filter)
    return [_format_submission_detail(s) for s in items]
