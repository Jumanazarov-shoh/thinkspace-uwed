"""
Notifications, Preferences, and Deadline Reminder API Endpoints for ThinkSpace | UWED.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.database import get_db
from app.api.deps import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.models.notification import Notification
from app.schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    AdminAnnouncementCreate,
    AdminNotificationStatusResponse,
    DeadlineReminderRunResponse,
)
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])

# ---------------------------------------------------------------------------
# Member In-App Notification Center
# ---------------------------------------------------------------------------

@router.get("", response_model=NotificationListResponse)
def get_my_notifications(
    unread_only: bool = Query(False, description="Filter for unread notifications only"),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List recent in-app notifications and unread count for the authenticated member."""
    items, total, unread_count = notification_service.get_user_notifications(
        session=db,
        user_id=current_user.id,
        limit=limit,
        unread_only=unread_only
    )
    return NotificationListResponse(
        items=[NotificationResponse.model_validate(n) for n in items],
        total=total,
        unread_count=unread_count
    )

@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a single notification as read."""
    notif = notification_service.mark_notification_as_read(
        session=db,
        user_id=current_user.id,
        notification_id=notification_id
    )
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Xabarnoma topilmadi yoki unga ruxsat yo'q"
        )
    db.commit()
    return NotificationResponse.model_validate(notif)

@router.post("/read-all", response_model=dict)
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all unread notifications as read for current authenticated user."""
    count = notification_service.mark_all_notifications_as_read(
        session=db,
        user_id=current_user.id
    )
    db.commit()
    return {"success": True, "marked_count": count}

# ---------------------------------------------------------------------------
# Notification Preferences
# ---------------------------------------------------------------------------

@router.get("/preferences", response_model=NotificationPreferenceResponse)
def get_my_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve notification preferences for authenticated user."""
    pref = notification_service.get_or_create_user_preferences(db, current_user.id)
    return NotificationPreferenceResponse(
        user_id=current_user.id,
        telegram_notifications_enabled=pref.telegram_notifications_enabled,
        deadline_reminders_enabled=pref.deadline_reminders_enabled
    )

@router.patch("/preferences", response_model=NotificationPreferenceResponse)
def update_my_notification_preferences(
    data: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update notification preferences for authenticated user."""
    pref = notification_service.update_user_preferences(
        session=db,
        user_id=current_user.id,
        telegram_enabled=data.telegram_notifications_enabled,
        deadline_reminders_enabled=data.deadline_reminders_enabled
    )
    db.commit()
    return NotificationPreferenceResponse(
        user_id=current_user.id,
        telegram_notifications_enabled=pref.telegram_notifications_enabled,
        deadline_reminders_enabled=pref.deadline_reminders_enabled
    )

# ---------------------------------------------------------------------------
# Administrative Endpoints
# ---------------------------------------------------------------------------

@router.get("/admin/status", response_model=AdminNotificationStatusResponse)
def get_admin_notification_status(
    current_user: User = Depends(require_roles([RoleEnum.SUPER_ADMIN.value, RoleEnum.MODERATOR.value, RoleEnum.EVALUATOR.value])),
    db: Session = Depends(get_db)
):
    """Administrative status overview of system notifications and delivery health."""
    total = db.execute(select(func.count(Notification.id))).scalar() or 0
    unread = db.execute(select(func.count(Notification.id)).where(Notification.is_read == False)).scalar() or 0
    tg_sent = db.execute(select(func.count(Notification.id)).where(Notification.telegram_delivery_status == "sent")).scalar() or 0
    tg_failed = db.execute(select(func.count(Notification.id)).where(Notification.telegram_delivery_status == "failed")).scalar() or 0
    tg_disabled = db.execute(select(func.count(Notification.id)).where(Notification.telegram_delivery_status == "disabled")).scalar() or 0

    return AdminNotificationStatusResponse(
        total_notifications=total,
        unread_notifications=unread,
        telegram_sent_count=tg_sent,
        telegram_failed_count=tg_failed,
        telegram_disabled_count=tg_disabled
    )

@router.post("/admin/announcement", response_model=dict)
def post_admin_announcement(
    data: AdminAnnouncementCreate,
    current_user: User = Depends(require_roles([RoleEnum.SUPER_ADMIN.value])),
    db: Session = Depends(get_db)
):
    """Send an authoritative administrative announcement to all approved ThinkSpace members."""
    count = notification_service.send_system_announcement(
        session=db,
        title=data.title,
        message=data.message,
        send_telegram=data.send_telegram
    )
    db.commit()
    return {"success": True, "recipients_count": count, "title": data.title}

@router.post("/admin/process-reminders", response_model=DeadlineReminderRunResponse)
def trigger_deadline_reminders(
    current_user: User = Depends(require_roles([RoleEnum.SUPER_ADMIN.value, RoleEnum.MODERATOR.value])),
    db: Session = Depends(get_db)
):
    """Execute idempotent deadline reminder processor."""
    result = notification_service.process_deadline_reminders(session=db)
    db.commit()
    return DeadlineReminderRunResponse(
        assignments_checked=result["assignments_checked"],
        reminders_sent=result["reminders_sent"],
        skipped_already_submitted=result["skipped_already_submitted"],
        skipped_duplicates=result["skipped_duplicates"],
        details=result["details"]
    )
