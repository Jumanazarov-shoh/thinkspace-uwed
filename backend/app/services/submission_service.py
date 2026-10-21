"""
Submission service.
Handles member submissions, multi-versioning, secure file uploads, and format validation.
"""
from datetime import datetime, timezone
import os
import uuid
from typing import List, Optional
from fastapi import UploadFile, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import settings
from app.models.assignment import Assignment, AssignmentStatus
from app.models.submission import Submission, SubmissionVersion, StoredFile, SubmissionStatus

async def submit_work(
    session: Session,
    assignment_id: int,
    user_id: int,
    text_content: Optional[str] = None,
    link_url: Optional[str] = None,
    uploaded_files: Optional[List[UploadFile]] = None
) -> Submission:
    stmt = select(Assignment).where(Assignment.id == assignment_id)
    result = session.execute(stmt)
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Topshiriq topilmadi (Assignment not found)")

    if assignment.status != AssignmentStatus.OPEN.value:
        raise HTTPException(status_code=400, detail="Bu topshiriq faol emas yoki yopilgan (Assignment is closed or not open)")

    if not text_content and not link_url and (not uploaded_files or len(uploaded_files) == 0):
        raise HTTPException(status_code=400, detail="Iltimos, matn, havola yoki fayl yuboring (Please provide text, link, or file)")

    sub_stmt = select(Submission).where(
        Submission.assignment_id == assignment_id,
        Submission.user_id == user_id
    )
    sub_res = session.execute(sub_stmt)
    submission = sub_res.scalar_one_or_none()

    if not submission:
        submission = Submission(
            assignment_id=assignment_id,
            user_id=user_id,
            status=SubmissionStatus.SUBMITTED.value,
        )
        session.add(submission)
        session.flush()
        version_num = 1
    else:
        if submission.status == SubmissionStatus.PUBLISHED.value:
            raise HTTPException(status_code=400, detail="Ushbu topshiriq baholangan, qayta topshirish mumkin emas (Grade already published)")
        version_num = len(submission.versions) + 1
        submission.status = SubmissionStatus.RESUBMITTED.value if submission.status == SubmissionStatus.REVISION_REQUESTED.value else SubmissionStatus.SUBMITTED.value

    sub_version = SubmissionVersion(
        submission_id=submission.id,
        version_number=version_num,
        text_content=text_content,
        link_url=link_url,
        submitted_at=datetime.now(timezone.utc)
    )
    session.add(sub_version)
    session.flush()

    submission.current_version_id = sub_version.id

    if uploaded_files:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024

        for file in uploaded_files:
            if not file.filename:
                continue

            ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
            if ext not in settings.ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Fayl formati qo'llab-quvvatlanmaydi: .{ext}. Ruxsat etilganlar: {', '.join(settings.ALLOWED_EXTENSIONS)}"
                )

            content = await file.read()
            if len(content) > max_bytes:
                raise HTTPException(
                    status_code=400,
                    detail=f"Fayl hajmi ruxsat etilgan {settings.MAX_FILE_SIZE_MB}MB dan oshib ketdi."
                )

            unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
            target_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

            with open(target_path, "wb") as f:
                f.write(content)

            stored_file = StoredFile(
                submission_version_id=sub_version.id,
                original_filename=file.filename,
                storage_path=target_path,
                mime_type=file.content_type or "application/octet-stream",
                file_size_bytes=len(content),
            )
            session.add(stored_file)

    session.flush()
    return submission

def get_submission_by_id(session: Session, submission_id: int) -> Optional[Submission]:
    stmt = select(Submission).where(Submission.id == submission_id)
    result = session.execute(stmt)
    return result.scalar_one_or_none()

def get_user_submission_for_assignment(
    session: Session,
    assignment_id: int,
    user_id: int
) -> Optional[Submission]:
    stmt = select(Submission).where(
        Submission.assignment_id == assignment_id,
        Submission.user_id == user_id
    )
    result = session.execute(stmt)
    return result.scalar_one_or_none()

def list_submissions_for_admin(
    session: Session,
    assignment_id: Optional[int] = None,
    status: Optional[str] = None
) -> List[Submission]:
    query = select(Submission)
    if assignment_id:
        query = query.where(Submission.assignment_id == assignment_id)
    if status:
        query = query.where(Submission.status == status)
    query = query.order_by(Submission.updated_at.desc())
    result = session.execute(query)
    return list(result.scalars().all())
