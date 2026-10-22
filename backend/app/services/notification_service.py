"""
Notification and Deadline Reminder Service for ThinkSpace | UWED.
Handles in-app notifications, Telegram delivery, preferences, and deduplicated reminders.
"""
from datetime import datetime, timezone, timedelta
import logging
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User, UserStatus, RoleEnum
from app.models.assignment import Assignment, AssignmentStatus
from app.models.submission import Submission, SubmissionStatus
from app.models.notification import (
    Notification,
    NotificationPreference,
    DeadlineReminderLog,
    NotificationType,
)

logger = logging.getLogger("thinkspace.notifications")

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def format_tashkent_datetime(dt: Optional[datetime]) -> str:
    if not dt:
        return "Belgilanmagan"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    # Display in Tashkent time (UTC+5)
    tashkent_tz = timezone(timedelta(hours=5))
    local_dt = dt.astimezone(tashkent_tz)
    return local_dt.strftime("%d.%m.%Y %H:%M (Toshkent vaqti)")

def get_or_create_user_preferences(session: Session, user_id: int) -> NotificationPreference:
    pref = session.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user_id)
    ).scalar_one_or_none()

    if not pref:
        pref = NotificationPreference(
            user_id=user_id,
            telegram_notifications_enabled=True,
            deadline_reminders_enabled=True,
            created_at=utc_now(),
            updated_at=utc_now()
        )
        session.add(pref)
        session.flush()
    return pref

def update_user_preferences(
    session: Session,
    user_id: int,
    telegram_enabled: Optional[bool] = None,
    deadline_reminders_enabled: Optional[bool] = None
) -> NotificationPreference:
    pref = get_or_create_user_preferences(session, user_id)
    if telegram_enabled is not None:
        pref.telegram_notifications_enabled = telegram_enabled
    if deadline_reminders_enabled is not None:
        pref.deadline_reminders_enabled = deadline_reminders_enabled
    pref.updated_at = utc_now()
    session.flush()
    return pref

def send_telegram_direct_sync(telegram_id: int, title: str, message: str) -> Tuple[bool, Optional[str]]:
    """
    Direct synchronous / resilient delivery of Telegram message using Bot API via httpx.
    Safely captures network errors, blocked bot, etc. Never raises an unhandled exception.
    """
    token = settings.TELEGRAM_BOT_TOKEN
    if not token or token.startswith("dummy_"):
        # Local mock development mode
        return True, "Mock dev mode delivery"

    try:
        import httpx
        clean_text = f"🏛 <b>ThinkSpace | UWED</b>\n\n<b>{title}</b>\n\n{message}\n\n🔗 <a href=\"{settings.MINI_APP_URL}\">ThinkSpace Mini App'da ochish</a>"
        with httpx.Client(timeout=10.0) as client:
            res = client.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={
                    "chat_id": telegram_id,
                    "text": clean_text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": False
                }
            )
            if res.status_code == 200:
                return True, None
            else:
                err = f"Telegram error {res.status_code}: {res.text}"
                logger.warning(f"Telegram API warning for user {telegram_id}: {err}")
                return False, err
    except Exception as e:
        err_msg = str(e)
        logger.warning(f"Failed to deliver Telegram notification to {telegram_id}: {err_msg}")
        return False, err_msg

def create_notification(
    session: Session,
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[str] = None,
    send_telegram: bool = True
) -> Notification:
    """
    Central notification generator. Creates an in-app notification and dispatches to Telegram
    if enabled by user preferences and available.
    """
    # Check user preferences
    prefs = get_or_create_user_preferences(session, user_id)
    user = session.get(User, user_id)
    
    telegram_status = "disabled"
    telegram_error = None

    is_reminder = (notification_type == NotificationType.DEADLINE_REMINDER.value)
    telegram_allowed = prefs.telegram_notifications_enabled
    if is_reminder and not prefs.deadline_reminders_enabled:
        telegram_allowed = False

    if send_telegram and telegram_allowed and user and user.telegram_id:
        success, err = send_telegram_direct_sync(user.telegram_id, title, message)
        if success:
            telegram_status = "sent"
        else:
            telegram_status = "failed"
            telegram_error = err

    notif = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        related_entity_type=related_entity_type,
        related_entity_id=str(related_entity_id) if related_entity_id else None,
        is_read=False,
        created_at=utc_now(),
        delivery_status="delivered",
        telegram_delivery_status=telegram_status,
        telegram_error=telegram_error
    )
    session.add(notif)
    session.flush()
    return notif

def get_user_notifications(
    session: Session,
    user_id: int,
    limit: int = 50,
    unread_only: bool = False
) -> Tuple[List[Notification], int, int]:
    base_query = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        base_query = base_query.where(Notification.is_read == False)

    # Total count
    total_stmt = select(func.count(Notification.id)).where(Notification.user_id == user_id)
    total = session.execute(total_stmt).scalar() or 0

    # Unread count
    unread_stmt = select(func.count(Notification.id)).where(
        Notification.user_id == user_id,
        Notification.is_read == False
    )
    unread_count = session.execute(unread_stmt).scalar() or 0

    items_stmt = base_query.order_by(Notification.created_at.desc()).limit(limit)
    items = session.execute(items_stmt).scalars().all()

    return list(items), total, unread_count

def mark_notification_as_read(session: Session, user_id: int, notification_id: int) -> Optional[Notification]:
    notif = session.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id
        )
    ).scalar_one_or_none()

    if notif:
        notif.is_read = True
        notif.read_at = utc_now()
        session.flush()
    return notif

def mark_all_notifications_as_read(session: Session, user_id: int) -> int:
    unreads = session.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read == False
        )
    ).scalars().all()

    now = utc_now()
    count = 0
    for n in unreads:
        n.is_read = True
        n.read_at = now
        count += 1
    session.flush()
    return count

# --- DOMAIN EVENT NOTIFIERS ---

def notify_assignment_published(session: Session, assignment: Assignment) -> int:
    """
    Notifies all approved members about a newly published assignment.
    """
    members = session.execute(
        select(User).where(User.status == UserStatus.APPROVED.value)
    ).scalars().all()

    deadline_str = format_tashkent_datetime(assignment.deadline_at)
    title = f"Yangi topshiriq: {assignment.title}"
    msg = (
        f"Yo'nalish: {assignment.direction}\n"
        f"Maksimal ball: {assignment.max_score}\n"
        f"Topshirish muddati (Deadline): {deadline_str}\n\n"
        f"{assignment.description[:180]}..."
    )

    sent_count = 0
    for m in members:
        create_notification(
            session=session,
            user_id=m.id,
            notification_type=NotificationType.ASSIGNMENT_PUBLISHED.value,
            title=title,
            message=msg,
            related_entity_type="assignment",
            related_entity_id=str(assignment.id),
            send_telegram=True
        )
        sent_count += 1
    return sent_count

def notify_submission_received(session: Session, submission: Submission, assignment: Assignment, is_late: bool = False) -> Notification:
    """
    Confirms formal submission to the student.
    """
    notif_type = NotificationType.SUBMISSION_LATE.value if is_late else NotificationType.SUBMISSION_RECEIVED.value
    status_label = "kechikib topshirildi" if is_late else "muvaffaqiyatli qabul qilindi"
    title = f"Topshiriq qabul qilindi: {assignment.title}"
    msg = (
        f"Sizning javobingiz ThinkSpace tizimiga {status_label} va tekshiruv navbatiga kiritildi. "
        f"Hakamlar hay'ati xulosasi va rasmiy baho tasdiqlangach, sizga xabar beriladi."
    )

    return create_notification(
        session=session,
        user_id=submission.user_id,
        notification_type=notif_type,
        title=title,
        message=msg,
        related_entity_type="assignment",
        related_entity_id=str(assignment.id),
        send_telegram=True
    )

def notify_evaluation_finalized(
    session: Session,
    submission: Submission,
    assignment: Assignment,
    final_score: float,
    overall_feedback: Optional[str] = None
) -> Notification:
    """
    Notifies student that their academic grade and feedback have been finalized.
    Strictly excludes private evaluator notes.
    """
    pct = round((final_score / max(assignment.max_score, 1)) * 100, 1)
    title = f"Baholash yakunlandi: {assignment.title}"
    feedback_excerpt = f"\n\nRasmiy xulosa: {overall_feedback[:150]}..." if overall_feedback else ""
    msg = (
        f"Sizning topshirig'ingiz hakamlar va moderator tomonidan to'liq ko'rib chiqildi.\n"
        f"Yakuniy ball: {final_score} / {assignment.max_score} ({pct}%){feedback_excerpt}\n\n"
        f"Batafsil rubrika tahlilini ilovada ko'rishingiz mumkin."
    )

    return create_notification(
        session=session,
        user_id=submission.user_id,
        notification_type=NotificationType.EVALUATION_FINALIZED.value,
        title=title,
        message=msg,
        related_entity_type="assignment",
        related_entity_id=str(assignment.id),
        send_telegram=True
    )

def send_system_announcement(session: Session, title: str, message: str, send_telegram: bool = True) -> int:
    """
    Mass administrative announcement from Super Admin to all active members.
    """
    members = session.execute(
        select(User).where(User.status == UserStatus.APPROVED.value)
    ).scalars().all()

    count = 0
    for m in members:
        create_notification(
            session=session,
            user_id=m.id,
            notification_type=NotificationType.SYSTEM_ANNOUNCEMENT.value,
            title=title,
            message=message,
            related_entity_type="announcement",
            send_telegram=send_telegram
        )
        count += 1
    return count

# --- DEADLINE REMINDER PROCESSOR ---

def process_deadline_reminders(session: Session) -> Dict[str, Any]:
    """
    Idempotent deadline reminder processor.
    Checks published, open assignments approaching deadlines:
    - 24 hours window (deadline within 24 hours)
    - 3 hours window (deadline within 3 hours)
    Only notifies members who have NOT submitted (or are in draft).
    Uses DeadlineReminderLog to guarantee zero duplicate messages.
    """
    now = utc_now()
    
    # 1. Fetch active assignments with upcoming deadlines
    assignments = session.execute(
        select(Assignment).where(
            Assignment.status.in_([AssignmentStatus.PUBLISHED.value, AssignmentStatus.OPEN.value]),
            Assignment.deadline_at != None,
            Assignment.deadline_at > now
        )
    ).scalars().all()

    # 2. Approved members
    members = session.execute(
        select(User).where(User.status == UserStatus.APPROVED.value)
    ).scalars().all()

    assignments_checked = len(assignments)
    reminders_sent = 0
    skipped_submitted = 0
    skipped_duplicates = 0
    details = []

    for a in assignments:
        if not a.deadline_at:
            continue
        dl = a.deadline_at
        if dl.tzinfo is None:
            dl = dl.replace(tzinfo=timezone.utc)
        diff_hours = (dl - now).total_seconds() / 3600.0
        
        # Determine applicable windows
        target_windows = []
        if diff_hours <= 24.0 and diff_hours > 3.0:
            target_windows.append("24h")
        elif diff_hours <= 3.0 and diff_hours > 0.0:
            # If 3 hours is reached, both 24h and 3h can apply, but 3h is primary
            target_windows.append("3h")

        if not target_windows:
            continue

        deadline_str = format_tashkent_datetime(a.deadline_at)

        for m in members:
            # Check if member has already formally submitted
            sub = session.execute(
                select(Submission).where(
                    Submission.assignment_id == a.id,
                    Submission.user_id == m.id
                )
            ).scalar_one_or_none()

            # If submitted formally (not draft), skip
            if sub and sub.status not in (SubmissionStatus.DRAFT.value, "draft", "not_started"):
                skipped_submitted += 1
                continue

            for win in target_windows:
                # Deduplication check
                existing_log = session.execute(
                    select(DeadlineReminderLog).where(
                        DeadlineReminderLog.assignment_id == a.id,
                        DeadlineReminderLog.user_id == m.id,
                        DeadlineReminderLog.reminder_window == win
                    )
                ).scalar_one_or_none()

                if existing_log:
                    skipped_duplicates += 1
                    continue

                # Prepare reminder text
                if win == "24h":
                    rem_title = f"Eslatma: 24 soat qoldi — {a.title}"
                    rem_msg = (
                        f"Hurmatli {m.first_name},\n"
                        f"\"{a.title}\" topshirig'ining muddatiga 24 soatdan kam vaqt qoldi.\n"
                        f"Topshirish muddati: {deadline_str}.\n"
                        f"Javobingizni o'z vaqtida yuklashni unutmang."
                    )
                else: # 3h
                    rem_title = f"Shoshiling: 3 soat qoldi — {a.title}"
                    rem_msg = (
                        f"Diqqat {m.first_name}!\n"
                        f"\"{a.title}\" topshirig'i bo'yicha muddat 3 soat ichida yakunlanadi.\n"
                        f"Yakuniy muddat: {deadline_str}.\n"
                        f"Kechikmaslik uchun javobingizni hoziroq tasdiqlang."
                    )

                create_notification(
                    session=session,
                    user_id=m.id,
                    notification_type=NotificationType.DEADLINE_REMINDER.value,
                    title=rem_title,
                    message=rem_msg,
                    related_entity_type="assignment",
                    related_entity_id=str(a.id),
                    send_telegram=True
                )

                # Record deduplication log
                session.add(DeadlineReminderLog(
                    assignment_id=a.id,
                    user_id=m.id,
                    reminder_window=win,
                    sent_at=now
                ))
                session.flush()

                reminders_sent += 1
                details.append({
                    "assignment_id": a.id,
                    "user_id": m.id,
                    "window": win,
                    "member": m.display_name
                })

    return {
        "assignments_checked": assignments_checked,
        "reminders_sent": reminders_sent,
        "skipped_already_submitted": skipped_submitted,
        "skipped_duplicates": skipped_duplicates,
        "details": details
    }

# Backward compatibility alias
async def send_telegram_notification(
    session: Session,
    user: User,
    notification_type: str,
    title: str,
    message: str
) -> Notification:
    return create_notification(
        session=session,
        user_id=user.id,
        notification_type=notification_type,
        title=title,
        message=message,
        send_telegram=True
    )
