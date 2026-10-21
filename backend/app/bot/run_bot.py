"""
Standalone runner for ThinkSpace | UWED Telegram Bot.
Run with: python -m app.bot.run_bot
"""
import asyncio
import logging
import sys
from app.config import settings
from app.database import create_tables
from app.bot.bot_instance import get_bot, dp
from app.bot.handlers.start import router as start_router
from app.bot.handlers.commands import router as commands_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("thinkspace.bot")

async def main():
    logger.info("Initializing ThinkSpace | UWED Telegram Bot...")
    
    if not settings.TELEGRAM_BOT_TOKEN or settings.TELEGRAM_BOT_TOKEN.startswith("dummy_"):
        logger.warning("==================================================================")
        logger.warning("TELEGRAM_BOT_TOKEN is not configured with a real token.")
        logger.warning("To connect the bot to Telegram:")
        logger.warning("1. Open Telegram and search for @BotFather")
        logger.warning("2. Send /newbot and choose a name and username")
        logger.warning("3. Copy the HTTP API token into your .env file as TELEGRAM_BOT_TOKEN")
        logger.warning("==================================================================")
        return

    # Ensure database tables exist
    create_tables()

    # Register routers
    dp.include_router(start_router)
    dp.include_router(commands_router)

    bot = get_bot()
    try:
        # Delete any pending webhook to use polling cleanly
        await bot.delete_webhook(drop_pending_updates=True)
        bot_info = await bot.get_me()
        logger.info(f"Bot successfully connected: @{bot_info.username} ({bot_info.full_name})")
        logger.info("Starting long polling...")
        await dp.start_polling(bot)
    finally:
        await bot.session.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Bot stopped.")
