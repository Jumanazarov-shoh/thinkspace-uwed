"""
aiogram 3.x Bot and Dispatcher setup with resilient fallback.
"""
from app.config import settings

try:
    from aiogram import Bot, Dispatcher
    from aiogram.enums import ParseMode
    from aiogram.client.default import DefaultBotProperties
    AIOGRAM_AVAILABLE = True
except Exception:
    AIOGRAM_AVAILABLE = False
    Bot = None
    Dispatcher = None
    ParseMode = None
    DefaultBotProperties = None

def get_bot():
    if not AIOGRAM_AVAILABLE or not Bot:
        return None
    return Bot(
        token=settings.TELEGRAM_BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML)
    )

dp = Dispatcher() if AIOGRAM_AVAILABLE and Dispatcher else None
