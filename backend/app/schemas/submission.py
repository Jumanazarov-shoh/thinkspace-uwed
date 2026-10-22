"""
Pydantic schemas for Submissions, Versions, Uploaded Files, and Summaries.
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
    download_url: Optional[str] = None

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
    review_status: str = "awaiting_evaluation"
    is_late: bool = False
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    latest_version: Optional[SubmissionVersionResponse] = None

class SubmissionDetailResponse(SubmissionResponse):
    versions: List[SubmissionVersionResponse] = []

class MySubmissionSummary(CompatBaseModel):
    id: int
    assignment_id: int
    assignment_title: str
    assignment_direction: str
    status: str
    review_status: str = "awaiting_evaluation"
    is_late: bool = False
    submitted_at: Optional[datetime] = None
    deadline: Optional[datetime] = None
    updated_at: datetime
    version_number: int = 1
    has_text: bool = False
    has_link: bool = False
    attachment_count: int = 0

class AdminSubmissionOverviewItem(CompatBaseModel):
    id: int
    assignment_id: int
    assignment_title: str
    assignment_direction: str
    user_id: int
    user_name: str
    user_telegram_username: Optional[str] = None
    status: str
    review_status: str = "awaiting_evaluation"
    is_late: bool = False
    submitted_at: Optional[datetime] = None
    updated_at: datetime
    version_number: int = 1
    attachment_count: int = 0
