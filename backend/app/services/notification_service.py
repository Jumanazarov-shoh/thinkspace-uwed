"""
Notification delivery service for ThinkSpace | UWED.
Safely dispatches messages via Telegram Bot API with error handling and retry logging.
"""
from datetime import datetime, timezone
import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.config import settings
from app.models.user import User
from app.models.audit import NotificationRecord

logger = logging.getLogger("thinkspace.notifications")

async def send_telegram_notification(
    session: Session,
    user: User,
    notification_type: str,
    title: str,
    message: str
) -> NotificationRecord:
    record = NotificationRecord(
        user_id=user.id,
        notification_type=notification_type,
        title=title,
        message=message,
        is_sent=False,
        attempts=1
    )
    session.add(record)
    session.flush()

    if settings.TELEGRAM_BOT_TOKEN and not settings.TELEGRAM_BOT_TOKEN.startswith("dummy_"):
        try:
            import httpx
            full_text = f"✨ <b>{title}</b>\n\n{message}\n\n🏛 <i>ThinkSpace | UWED</i>"
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                    json={
                        "chat_id": user.telegram_id,
                        "text": full_text,
                        "parse_mode": "HTML"
                    }
                )
                if res.status_code == 200:
                    record.is_sent = True
                    record.sent_at = datetime.now(timezone.utc)
                else:
                    record.error_message = res.text
                    logger.warning(f"Telegram API warning: {res.text}")
        except Exception as e:
            logger.warning(f"Failed to send notification to Telegram user {user.telegram_id}: {e}")
            record.error_message = str(e)
    else:
        record.is_sent = True
        record.sent_at = datetime.now(timezone.utc)

    session.flush()
    return record
