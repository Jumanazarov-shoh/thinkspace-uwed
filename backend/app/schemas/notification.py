"""
Pydantic schemas for Notifications, Preferences, and Reminders.
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import Field
from app.schemas.compat import CompatBaseModel

class NotificationResponse(CompatBaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    delivery_status: str
    telegram_delivery_status: str
    telegram_error: Optional[str] = None

class NotificationListResponse(CompatBaseModel):
    items: List[NotificationResponse]
    total: int
    unread_count: int

class NotificationPreferenceResponse(CompatBaseModel):
    user_id: int
    telegram_notifications_enabled: bool
    deadline_reminders_enabled: bool

class NotificationPreferenceUpdate(CompatBaseModel):
    telegram_notifications_enabled: Optional[bool] = None
    deadline_reminders_enabled: Optional[bool] = None

class AdminAnnouncementCreate(CompatBaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    message: str = Field(..., min_length=5, max_length=2000)
    send_telegram: bool = True

class AdminNotificationStatusResponse(CompatBaseModel):
    total_notifications: int
    unread_notifications: int
    telegram_sent_count: int
    telegram_failed_count: int
    telegram_disabled_count: int

class DeadlineReminderRunResponse(CompatBaseModel):
    assignments_checked: int
    reminders_sent: int
    skipped_already_submitted: int
    skipped_duplicates: int
    details: List[Dict[str, Any]]
