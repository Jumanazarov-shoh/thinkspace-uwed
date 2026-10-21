"""
Resilient runner for ThinkSpace | UWED Telegram Bot.
Supports standard aiogram 3.x and pure-python httpx polling fallback.
"""
import asyncio
import logging
from app.config import settings
from app.database import create_tables, SessionLocal
from app.models.user import User, UserStatus, RoleEnum
from app.models.assignment import Assignment, AssignmentStatus
from app.services.user_service import get_or_create_user_from_telegram
from app.services.leaderboard_service import calculate_leaderboard, calculate_member_progress
from sqlalchemy import select

logger = logging.getLogger("thinkspace.bot")

async def run_httpx_polling(token: str):
    """
    Pure-Python HTTP polling runner for Telegram Bot API.
    Zero native DLL dependencies, works on any OS including AppLocker/WDAC environments.
    """
    import httpx
    
    base_url = f"https://api.telegram.org/bot{token}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Test getMe
        try:
            res = await client.get(f"{base_url}/getMe")
            data = res.json()
            if not data.get("ok"):
                logger.error(f"Telegram Bot Authentication Failed: {data.get('description')}")
                return
            bot_info = data["result"]
            logger.info(f"Bot successfully connected: @{bot_info.get('username')} ({bot_info.get('first_name')})")
        except Exception as e:
            logger.error(f"Cannot reach Telegram Bot API: {e}")
            return

        # 2. Delete webhook
        await client.post(f"{base_url}/deleteWebhook", json={"drop_pending_updates": True})
        logger.info("Starting Telegram HTTP long polling...")
        
        offset = 0
        while True:
            try:
                res = await client.post(
                    f"{base_url}/getUpdates",
                    json={"offset": offset, "timeout": 20, "allowed_updates": ["message"]}
                )
                updates = res.json().get("result", [])
                
                for update in updates:
                    offset = max(offset, update["update_id"] + 1)
                    message = update.get("message")
                    if not message or "text" not in message:
                        continue
                    
                    chat_id = message["chat"]["id"]
                    text = message.get("text", "").strip()
                    tg_user = message.get("from", {})
                    
                    # Command router
                    if text.startswith("/start"):
                        with SessionLocal() as session:
                            user = get_or_create_user_from_telegram(
                                session=session,
                                telegram_id=tg_user.get("id"),
                                first_name=tg_user.get("first_name", "Student"),
                                last_name=tg_user.get("last_name"),
                                username=tg_user.get("username"),
                                preferred_language=tg_user.get("language_code", "uz")
                            )
                            session.commit()
                            session.refresh(user)
                            user_status = user.status

                        welcome_text = (
                            f"🏛 <b>ThinkSpace | UWED</b>\n"
                            f"<i>Xalqaro iqtisodiyot va menejment fakulteti intellektual klubi</i>\n\n"
                            f"Assalomu alaykum, <b>{tg_user.get('first_name')}</b>!\n\n"
                            f"Klubimiz 6 ta asosiy yo'nalish bo'yicha faoliyat yuritadi:\n"
                            f"• <b>Think & Read</b> — Kitob va maqolalar sharhi\n"
                            f"• <b>Think & Discuss</b> — Debatlar va muloqot\n"
                            f"• <b>Think & Analyze</b> — Keys-stadi va tahlil\n"
                            f"• <b>Think & Lead</b> — Yetakchilik va boshqaruv\n"
                            f"• <b>Think & Create</b> — Yangi g'oyalar va innovatsiya\n"
                            f"• <b>Think & Connect</b> — Professional tarmoq\n\n"
                        )
                        if user_status == UserStatus.APPROVED.value:
                            welcome_text += "✅ Siz klubning rasmiy a'zosisiz! Mini App orqali topshiriqlarni ko'ring:"
                        else:
                            welcome_text += "Mini App ilovamiz orqali platformaga kiring:"

                        keyboard = {
                            "inline_keyboard": [[{
                                "text": "🚀 ThinkSpace Mini App",
                                "web_app": {"url": settings.MINI_APP_URL}
                            }]]
                        }
                        await client.post(f"{base_url}/sendMessage", json={
                            "chat_id": chat_id,
                            "text": welcome_text,
                            "parse_mode": "HTML",
                            "reply_markup": keyboard
                        })

                    elif text.startswith("/help"):
                        help_text = (
                            "📚 <b>ThinkSpace | UWED Bot Buyruqlari</b>\n\n"
                            "• /start — Botni ishga tushirish\n"
                            "• /tasks — Faol topshiriqlar\n"
                            "• /leaderboard — Klub reytingi\n"
                            "• /profile — Sizning profilingiz\n"
                            "• /help — Yordam"
                        )
                        keyboard = {
                            "inline_keyboard": [[{
                                "text": "📱 Mini App",
                                "web_app": {"url": settings.MINI_APP_URL}
                            }]]
                        }
                        await client.post(f"{base_url}/sendMessage", json={
                            "chat_id": chat_id,
                            "text": help_text,
                            "parse_mode": "HTML",
                            "reply_markup": keyboard
                        })

                    elif text.startswith("/tasks"):
                        with SessionLocal() as session:
                            stmt = select(Assignment).where(Assignment.status == AssignmentStatus.OPEN.value)
                            tasks = session.execute(stmt).scalars().all()

                        if not tasks:
                            reply = "📌 Hozirda faol topshiriqlar mavjud emas."
                        else:
                            reply = "📝 <b>Faol Topshiriqlar:</b>\n\n"
                            for idx, t in enumerate(tasks, 1):
                                reply += f"{idx}. <b>{t.title}</b> ({t.direction}) — {t.max_score} ball\n"

                        keyboard = {
                            "inline_keyboard": [[{
                                "text": "🚀 Topshirish (Mini App)",
                                "web_app": {"url": f"{settings.MINI_APP_URL}/tasks"}
                            }]]
                        }
                        await client.post(f"{base_url}/sendMessage", json={
                            "chat_id": chat_id,
                            "text": reply,
                            "parse_mode": "HTML",
                            "reply_markup": keyboard
                        })

                    elif text.startswith("/leaderboard"):
                        with SessionLocal() as session:
                            top_entries = calculate_leaderboard(session, limit=5)

                        if not top_entries:
                            reply = "🏆 Hozircha e'lon qilingan rasmiy baholar mavjud emas."
                        else:
                            reply = "🏆 <b>ThinkSpace | UWED Top A'zolar:</b>\n\n"
                            for idx, entry in enumerate(top_entries, 1):
                                reply += f"{idx}. <b>{entry.display_name}</b> — {entry.total_score} ball\n"

                        keyboard = {
                            "inline_keyboard": [[{
                                "text": "📊 To'liq reyting",
                                "web_app": {"url": f"{settings.MINI_APP_URL}/leaderboard"}
                            }]]
                        }
                        await client.post(f"{base_url}/sendMessage", json={
                            "chat_id": chat_id,
                            "text": reply,
                            "parse_mode": "HTML",
                            "reply_markup": keyboard
                        })
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Polling loop notice: {e}")
                await asyncio.sleep(2)

async def start_bot():
    """Main entrypoint for starting the bot."""
    logger.info("Initializing ThinkSpace | UWED Telegram Bot...")
    
    if not settings.TELEGRAM_BOT_TOKEN or settings.TELEGRAM_BOT_TOKEN.startswith("dummy_"):
        logger.warning("==================================================================")
        logger.warning("TELEGRAM_BOT_TOKEN is not configured with a live token.")
        logger.warning("To connect the bot to Telegram:")
        logger.warning("1. Open Telegram and search for @BotFather")
        logger.warning("2. Send /newbot and choose a name and username")
        logger.warning("3. Copy the HTTP API token into your .env file as TELEGRAM_BOT_TOKEN")
        logger.warning("==================================================================")
        return False

    create_tables()

    # Try standard aiogram 3.x first
    try:
        from app.bot.bot_instance import get_bot, dp
        from app.bot.handlers.start import router as start_router
        from app.bot.handlers.commands import router as commands_router
        
        dp.include_router(start_router)
        dp.include_router(commands_router)
        bot = get_bot()
        try:
            await bot.delete_webhook(drop_pending_updates=True)
            bot_info = await bot.get_me()
            logger.info(f"Bot connected via aiogram: @{bot_info.username}")
            await dp.start_polling(bot)
            return True
        finally:
            await bot.session.close()
    except Exception as e:
        logger.info(f"aiogram engine notice ({e}), utilizing resilient HTTP long-polling runner.")
        await run_httpx_polling(settings.TELEGRAM_BOT_TOKEN)
        return True
