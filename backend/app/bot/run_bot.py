"""
Standalone runner for ThinkSpace | UWED Telegram Bot.
Run with: python -m app.bot.run_bot
"""
import asyncio
import logging
from app.bot.runner import start_bot

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("thinkspace.bot")

if __name__ == "__main__":
    try:
        asyncio.run(start_bot())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Bot stopped.")
