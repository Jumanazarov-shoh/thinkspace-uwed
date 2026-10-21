"""
Pydantic schemas for Submissions, Versions, and Uploaded Files.
"""
from datetime import datetime
from typing import List, Optional
from app.schemas.compat import CompatBaseModel
from app.schemas.user import UserResponse

class StoredFileResponse(CompatBaseModel):
    id: int
    original_filename: str
    mime_type: str
    file_size_bytes: int
    telegram_file_id: Optional[str] = None
    uploaded_at: datetime

class SubmissionVersionResponse(CompatBaseModel):
    id: int
    version_number: int
    text_content: Optional[str] = None
    link_url: Optional[str] = None
    submitted_at: datetime
    files: List[StoredFileResponse] = []

class SubmissionCreate(CompatBaseModel):
    text_content: Optional[str] = None
    link_url: Optional[str] = None

class SubmissionResponse(CompatBaseModel):
    id: int
    assignment_id: int
    user_id: int
    user: Optional[UserResponse] = None
    status: str
    created_at: datetime
    updated_at: datetime
    latest_version: Optional[SubmissionVersionResponse] = None

class SubmissionDetailResponse(SubmissionResponse):
    versions: List[SubmissionVersionResponse] = []
