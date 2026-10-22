"""
Submission service for ThinkSpace | UWED.
Manages member submissions, drafts, deadlines, multi-content responses,
secure file uploads via StorageProvider, and audit trails.
"""
from datetime import datetime, timezone
import os
import urllib.parse
from typing import List, Optional
from fastapi import UploadFile, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.config import settings
from app.models.assignment import Assignment, AssignmentStatus
from app.models.submission import Submission, SubmissionVersion, StoredFile, SubmissionStatus
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.submission import MySubmissionSummary, AdminSubmissionOverviewItem
from app.services.storage_service import get_storage_provider
from app.services.notification_service import notify_submission_received

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def validate_url_format(url: Optional[str]) -> Optional[str]:
    if not url or not url.strip():
        return None
    cleaned = url.strip()
    if not (cleaned.startswith("http://") or cleaned.startswith("https://")):
        raise HTTPException(
            status_code=400,
            detail="Havola 'http://' yoki 'https://' bilan boshlanishi kerak (Invalid URL protocol)."
        )
    try:
        parsed = urllib.parse.urlparse(cleaned)
        if not parsed.netloc or "." not in parsed.netloc:
            raise ValueError()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Noto'g'ri havola formati (Malformed URL provided)."
        )
    return cleaned

def validate_text_content(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    if len(text) > 25000:
        raise HTTPException(
            status_code=400,
            detail="Matn hajmi juda katta (maksimal 25,000 belgi ruxsat etiladi)."
        )
    return text

def calculate_is_late(deadline_at: Optional[datetime]) -> bool:
    if not deadline_at:
        return False
    now = utc_now()
    if deadline_at.tzinfo is None:
        return now.replace(tzinfo=None) > deadline_at
    return now > deadline_at

async def save_draft(
    session: Session,
    assignment_id: int,
    user_id: int,
    text_content: Optional[str] = None,
    link_url: Optional[str] = None,
    uploaded_files: Optional[List[UploadFile]] = None
) -> Submission:
    stmt = select(Assignment).where(Assignment.id == assignment_id)
    assignment = session.execute(stmt).scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Topshiriq topilmadi (Assignment not found)")

    if assignment.status in [AssignmentStatus.DRAFT.value, AssignmentStatus.ARCHIVED.value]:
        raise HTTPException(
            status_code=400,
            detail="Ushbu topshiriq faol emas (Assignment is draft or archived)"
        )

    clean_text = validate_text_content(text_content)
    clean_url = validate_url_format(link_url)

    sub_stmt = select(Submission).where(
        Submission.assignment_id == assignment_id,
        Submission.user_id == user_id
    )
    submission = session.execute(sub_stmt).scalar_one_or_none()

    if submission:
        if submission.status == SubmissionStatus.LOCKED.value:
            raise HTTPException(
                status_code=400,
                detail="Ushbu topshiriq qulflangan, tahrirlash mumkin emas (Submission is locked)"
            )
        if submission.status in [SubmissionStatus.PUBLISHED.value, SubmissionStatus.APPROVED.value]:
            raise HTTPException(
                status_code=400,
                detail="Topshiriq baholangan, tahrirlash mumkin emas (Submission has already been graded)"
            )

        # If current submission is already draft, update current version
        if submission.status == SubmissionStatus.DRAFT.value and submission.latest_version:
            current_ver = submission.latest_version
            if clean_text is not None:
                current_ver.text_content = clean_text
            if clean_url is not None:
                current_ver.link_url = clean_url
            target_version = current_ver
        else:
            # Resubmitting draft after prior submission
            version_num = len(submission.versions) + 1
            target_version = SubmissionVersion(
                submission_id=submission.id,
                version_number=version_num,
                text_content=clean_text if clean_text is not None else (submission.latest_version.text_content if submission.latest_version else None),
                link_url=clean_url if clean_url is not None else (submission.latest_version.link_url if submission.latest_version else None),
                submitted_at=utc_now()
            )
            session.add(target_version)
            session.flush()
            submission.current_version_id = target_version.id

        submission.status = SubmissionStatus.DRAFT.value
        submission.updated_at = utc_now()
    else:
        submission = Submission(
            assignment_id=assignment_id,
            user_id=user_id,
            status=SubmissionStatus.DRAFT.value,
            is_late=False,
            submitted_at=None
        )
        session.add(submission)
        session.flush()

        target_version = SubmissionVersion(
            submission_id=submission.id,
            version_number=1,
            text_content=clean_text,
            link_url=clean_url,
            submitted_at=utc_now()
        )
        session.add(target_version)
        session.flush()
        submission.current_version_id = target_version.id

    # Handle file uploads if any
    if uploaded_files:
        storage = get_storage_provider()
        for file in uploaded_files:
            if not file.filename:
                continue
            content = await file.read()
            if not content:
                continue
            stored_path, size_bytes = await storage.save_file(
                content=content,
                original_filename=file.filename,
                mime_type=file.content_type or "application/octet-stream"
            )
            stored_file = StoredFile(
                submission_version_id=target_version.id,
                original_filename=file.filename,
                storage_path=stored_path,
                mime_type=file.content_type or "application/octet-stream",
                file_size_bytes=size_bytes,
                uploaded_at=utc_now()
            )
            session.add(stored_file)

    audit = AuditLog(
        user_id=user_id,
        action="submission_draft_saved",
        entity_type="submission",
        entity_id=str(submission.id),
        details={
            "assignment_id": assignment_id,
            "version": target_version.version_number
        }
    )
    session.add(audit)
    session.flush()
    return submission

async def submit_work(
    session: Session,
    assignment_id: int,
    user_id: int,
    text_content: Optional[str] = None,
    link_url: Optional[str] = None,
    uploaded_files: Optional[List[UploadFile]] = None
) -> Submission:
    stmt = select(Assignment).where(Assignment.id == assignment_id)
    assignment = session.execute(stmt).scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Topshiriq topilmadi (Assignment not found)")

    if assignment.status in [AssignmentStatus.DRAFT.value, AssignmentStatus.ARCHIVED.value]:
        raise HTTPException(
            status_code=400,
            detail="Ushbu topshiriq faol emas (Assignment is draft or archived)"
        )
    if assignment.status == AssignmentStatus.CLOSED.value:
        raise HTTPException(
            status_code=400,
            detail="Topshiriq qabul qilish yakunlangan (Assignment is closed)"
        )

    clean_text = validate_text_content(text_content)
    clean_url = validate_url_format(link_url)

    sub_stmt = select(Submission).where(
        Submission.assignment_id == assignment_id,
        Submission.user_id == user_id
    )
    submission = session.execute(sub_stmt).scalar_one_or_none()

    existing_files_count = 0
    if submission and submission.latest_version:
        existing_files_count = len(submission.latest_version.files)

    has_content = bool(
        (clean_text and clean_text.strip()) or
        (clean_url and clean_url.strip()) or
        (uploaded_files and any(f.filename for f in uploaded_files)) or
        (existing_files_count > 0 and clean_text is None and clean_url is None)
    )
    if not has_content:
        raise HTTPException(
            status_code=400,
            detail="Iltimos, matn, havola yoki fayl yuboring (Empty submission not allowed)."
        )

    if submission and submission.status == SubmissionStatus.LOCKED.value:
        raise HTTPException(
            status_code=400,
            detail="Ushbu topshiriq qulflangan, qayta topshirish mumkin emas (Submission is locked)"
        )
    if submission and submission.status in [SubmissionStatus.PUBLISHED.value, SubmissionStatus.APPROVED.value]:
        raise HTTPException(
            status_code=400,
            detail="Topshiriq baholangan, qayta topshirish mumkin emas (Submission has already been graded)"
        )

    is_late = calculate_is_late(assignment.deadline_at)
    final_status = SubmissionStatus.LATE.value if is_late else SubmissionStatus.SUBMITTED.value
    now = utc_now()

    storage = get_storage_provider()

    if submission:
        # If currently a draft, upgrade this draft version to submitted
        if submission.status == SubmissionStatus.DRAFT.value and submission.latest_version:
            target_version = submission.latest_version
            if clean_text is not None:
                target_version.text_content = clean_text
            if clean_url is not None:
                target_version.link_url = clean_url
            target_version.submitted_at = now
        else:
            # Resubmitting after a prior submission
            version_num = len(submission.versions) + 1
            target_version = SubmissionVersion(
                submission_id=submission.id,
                version_number=version_num,
                text_content=clean_text if clean_text is not None else (submission.latest_version.text_content if submission.latest_version else None),
                link_url=clean_url if clean_url is not None else (submission.latest_version.link_url if submission.latest_version else None),
                submitted_at=now
            )
            session.add(target_version)
            session.flush()
            submission.current_version_id = target_version.id

        submission.status = final_status
        submission.is_late = is_late
        submission.submitted_at = now
        submission.updated_at = now
    else:
        submission = Submission(
            assignment_id=assignment_id,
            user_id=user_id,
            status=final_status,
            is_late=is_late,
            submitted_at=now
        )
        session.add(submission)
        session.flush()

        target_version = SubmissionVersion(
            submission_id=submission.id,
            version_number=1,
            text_content=clean_text,
            link_url=clean_url,
            submitted_at=now
        )
        session.add(target_version)
        session.flush()
        submission.current_version_id = target_version.id

    # Handle file uploads
    if uploaded_files:
        for file in uploaded_files:
            if not file.filename:
                continue
            content = await file.read()
            if not content:
                continue
            stored_path, size_bytes = await storage.save_file(
                content=content,
                original_filename=file.filename,
                mime_type=file.content_type or "application/octet-stream"
            )
            stored_file = StoredFile(
                submission_version_id=target_version.id,
                original_filename=file.filename,
                storage_path=stored_path,
                mime_type=file.content_type or "application/octet-stream",
                file_size_bytes=size_bytes,
                uploaded_at=now
            )
            session.add(stored_file)

    audit = AuditLog(
        user_id=user_id,
        action="submission_finalized",
        entity_type="submission",
        entity_id=str(submission.id),
        details={
            "assignment_id": assignment_id,
            "status": final_status,
            "is_late": is_late,
            "version": target_version.version_number
        }
    )
    session.add(audit)
    session.flush()

    try:
        notify_submission_received(session, submission, assignment, is_late=is_late)
    except Exception:
        pass

    return submission

def delete_submission_attachment(
    session: Session,
    submission_id: int,
    file_id: int,
    user_id: int
) -> bool:
    sub = session.execute(
        select(Submission).where(Submission.id == submission_id)
    ).scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Topshiriq topilmadi")

    if sub.user_id != user_id:
        raise HTTPException(status_code=403, detail="Boshqa a'zoning faylini o'chirishga ruxsat yo'q")

    if sub.status == SubmissionStatus.LOCKED.value:
        raise HTTPException(status_code=400, detail="Qulflangan topshiriq faylini o'chirib bo'lmaydi")

    stored_file = session.execute(
        select(StoredFile).where(StoredFile.id == file_id)
    ).scalar_one_or_none()
    if not stored_file:
        raise HTTPException(status_code=404, detail="Fayl topilmadi")

    # Verify attachment belongs to this submission
    version_ids = [v.id for v in sub.versions]
    if stored_file.submission_version_id not in version_ids:
        raise HTTPException(status_code=400, detail="Fayl ushbu topshiriqqa tegishli emas")

    storage = get_storage_provider()
    storage.delete_file(stored_file.storage_path)

    for v in sub.versions:
        if stored_file in v.files:
            v.files.remove(stored_file)

    session.delete(stored_file)
    session.add(AuditLog(
        user_id=user_id,
        action="attachment_deleted",
        entity_type="stored_file",
        entity_id=str(file_id),
        details={"submission_id": submission_id}
    ))
    session.flush()
    return True

def get_submission_by_id(session: Session, submission_id: int) -> Optional[Submission]:
    stmt = select(Submission).where(Submission.id == submission_id)
    return session.execute(stmt).scalar_one_or_none()

def get_user_submission_for_assignment(
    session: Session,
    assignment_id: int,
    user_id: int
) -> Optional[Submission]:
    stmt = select(Submission).where(
        Submission.assignment_id == assignment_id,
        Submission.user_id == user_id
    )
    return session.execute(stmt).scalar_one_or_none()

def list_my_submissions(session: Session, user_id: int) -> List[MySubmissionSummary]:
    stmt = (
        select(Submission, Assignment)
        .join(Assignment, Submission.assignment_id == Assignment.id)
        .where(Submission.user_id == user_id)
        .order_by(Submission.updated_at.desc())
    )
    rows = session.execute(stmt).all()
    summaries = []
    for sub, assign in rows:
        latest = sub.latest_version
        summaries.append(MySubmissionSummary(
            id=sub.id,
            assignment_id=assign.id,
            assignment_title=assign.title,
            assignment_direction=assign.direction,
            status=sub.status,
            review_status=getattr(sub, "review_status", "awaiting_evaluation"),
            is_late=sub.is_late,
            submitted_at=sub.submitted_at,
            deadline=assign.deadline_at,
            updated_at=sub.updated_at,
            version_number=latest.version_number if latest else 1,
            has_text=bool(latest and latest.text_content),
            has_link=bool(latest and latest.link_url),
            attachment_count=len(latest.files) if latest else 0
        ))
    return summaries

def list_submissions_for_admin_overview(
    session: Session,
    assignment_id: Optional[int] = None,
    status_filter: Optional[str] = None
) -> List[AdminSubmissionOverviewItem]:
    stmt = (
        select(Submission, Assignment, User)
        .join(Assignment, Submission.assignment_id == Assignment.id)
        .join(User, Submission.user_id == User.id)
    )
    if assignment_id:
        stmt = stmt.where(Submission.assignment_id == assignment_id)
    if status_filter:
        stmt = stmt.where(Submission.status == status_filter)
    stmt = stmt.order_by(Submission.updated_at.desc())

    rows = session.execute(stmt).all()
    items = []
    for sub, assign, usr in rows:
        latest = sub.latest_version
        user_name = usr.display_name or f"{usr.first_name} {usr.last_name or ''}".strip() or "Talaba"
        items.append(AdminSubmissionOverviewItem(
            id=sub.id,
            assignment_id=assign.id,
            assignment_title=assign.title,
            assignment_direction=assign.direction,
            user_id=usr.id,
            user_name=user_name,
            user_telegram_username=usr.username,
            status=sub.status,
            review_status=getattr(sub, "review_status", "awaiting_evaluation"),
            is_late=sub.is_late,
            submitted_at=sub.submitted_at,
            updated_at=sub.updated_at,
            version_number=latest.version_number if latest else 1,
            attachment_count=len(latest.files) if latest else 0
        ))
    return items

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
