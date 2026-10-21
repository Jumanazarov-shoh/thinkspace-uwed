"""
Notification delivery service for ThinkSpace | UWED.
Safely dispatches messages via aiogram Telegram Bot with error handling and retry logging.
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
            from aiogram import Bot
            from aiogram.enums import ParseMode
            
            bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
            try:
                full_text = f"✨ <b>{title}</b>\n\n{message}\n\n🏛 <i>ThinkSpace | UWED</i>"
                await bot.send_message(
                    chat_id=user.telegram_id,
                    text=full_text,
                    parse_mode=ParseMode.HTML
                )
                record.is_sent = True
                record.sent_at = datetime.now(timezone.utc)
            finally:
                await bot.session.close()
        except Exception as e:
            logger.warning(f"Failed to send notification to Telegram user {user.telegram_id}: {e}")
            record.error_message = str(e)
    else:
        record.is_sent = True
        record.sent_at = datetime.now(timezone.utc)

    session.flush()
    return record
