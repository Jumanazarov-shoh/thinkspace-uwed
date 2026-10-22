"""
Resilient runner for ThinkSpace | UWED Telegram Bot.
Supports conversational membership application (name -> faculty -> pending -> admin approval),
resilient polling, HTML escaping, and Mini App launching.
"""
import asyncio
import logging
from typing import Dict
from sqlalchemy import select
from app.config import settings
from app.database import create_tables, SessionLocal
from app.models.user import User, UserStatus, RoleEnum, MembershipRequest
from app.models.assignment import Assignment, AssignmentStatus
from app.services.user_service import (
    get_or_create_user_from_telegram,
    get_user_by_telegram_id,
    submit_membership_request
)
from app.services.leaderboard_service import calculate_leaderboard, calculate_member_progress

logger = logging.getLogger("thinkspace.bot")

def html_escape(s: str) -> str:
    """Escapes HTML special characters for Telegram Bot API HTML parse mode."""
    if not s:
        return ""
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

async def run_httpx_polling(token: str):
    """
    Pure-Python HTTP polling runner for Telegram Bot API.
    Zero native DLL dependencies, works reliably inside FastAPI lifespan.
    Handles onboarding registration dialog:
    1. /start -> Ask full name
    2. Receive name -> Ask faculty & group
    3. Receive faculty -> Save MembershipRequest as pending -> Inform student & notify admin
    """
    import httpx
    
    base_url = f"https://api.telegram.org/bot{token}"
    user_steps: Dict[int, str] = {}
    
    async with httpx.AsyncClient(timeout=35.0) as client:
        # 1. Test getMe
        try:
            res = await client.get(f"{base_url}/getMe")
            data = res.json()
            if not data.get("ok"):
                print(f"[bot] Telegram Bot Authentication Failed: {data.get('description')}")
                return
            bot_info = data["result"]
            print(f"[bot] Connected to Telegram: @{bot_info.get('username')} ({bot_info.get('first_name')})")
        except Exception as e:
            print(f"[bot] Cannot reach Telegram Bot API: {e}")
            return

        # 2. Reset webhook without dropping pending updates
        try:
            await client.post(f"{base_url}/deleteWebhook", json={"drop_pending_updates": False})
        except Exception as e:
            print(f"[bot] deleteWebhook notice: {e}")

        print("[bot] Telegram bot HTTP polling loop started.")
        offset = 0
        
        while True:
            try:
                res = await client.post(
                    f"{base_url}/getUpdates",
                    json={"offset": offset, "timeout": 20, "allowed_updates": ["message"]}
                )
                if res.status_code != 200:
                    await asyncio.sleep(2)
                    continue

                updates = res.json().get("result", [])
                
                for update in updates:
                    offset = max(offset, update["update_id"] + 1)
                    message = update.get("message")
                    if not message or "text" not in message:
                        continue
                    
                    chat_id = message["chat"]["id"]
                    text = message.get("text", "").strip()
                    tg_user = message.get("from", {})
                    user_tg_id = tg_user.get("id") or chat_id
                    print(f"[bot] Received from {chat_id} ({tg_user.get('first_name')}): {text}")

                    # --- COMMAND: /start ---
                    if text.startswith("/start"):
                        with SessionLocal() as session:
                            user = get_or_create_user_from_telegram(
                                session=session,
                                telegram_id=user_tg_id,
                                first_name=tg_user.get("first_name", "Student"),
                                last_name=tg_user.get("last_name"),
                                username=tg_user.get("username"),
                                preferred_language=tg_user.get("language_code", "uz")
                            )
                            session.commit()
                            session.refresh(user)

                            is_super_admin = (
                                settings.SUPER_ADMIN_TELEGRAM_ID > 0 and 
                                user_tg_id == settings.SUPER_ADMIN_TELEGRAM_ID
                            )
                            user_status = user.status
                            has_request = len(user.membership_requests) > 0

                        # Case A: Super Admin
                        if is_super_admin:
                            reply_text = (
                                "🏛 <b>ThinkSpace | UWED</b>\n\n"
                                f"👑 Assalomu alaykum, <b>{html_escape(user.display_name)}</b>!\n\n"
                                "Siz platformaning <b>Bosh Administratori</b> (Super Admin) sifatida tasdiqlandingiz.\n"
                                "Boshqaruv paneliga kirish va talabalarni tasdiqlash uchun Mini App'ni oching:"
                            )
                            keyboard = {
                                "inline_keyboard": [[{
                                    "text": "🛡️ ThinkSpace (Admin)",
                                    "web_app": {"url": settings.MINI_APP_URL}
                                }]]
                            }
                            await client.post(f"{base_url}/sendMessage", json={
                                "chat_id": chat_id,
                                "text": reply_text,
                                "parse_mode": "HTML",
                                "reply_markup": keyboard
                            })
                            continue

                        # Case B: Approved Member
                        if user_status == UserStatus.APPROVED.value:
                            reply_text = (
                                "🏛 <b>ThinkSpace | UWED</b>\n"
                                "<i>Xalqaro iqtisodiyot va menejment fakulteti intellektual klubi</i>\n\n"
                                f"Assalomu alaykum, <b>{html_escape(user.display_name)}</b>!\n\n"
                                "✅ <b>Siz klubning rasmiy a'zosisiz!</b>\n\n"
                                "Klubimiz 6 ta asosiy yo'nalish bo'yicha faoliyat yuritadi:\n"
                                "• <b>Think &amp; Read</b> — Kitob va maqolalar sharhi\n"
                                "• <b>Think &amp; Discuss</b> — Debatlar va muloqot\n"
                                "• <b>Think &amp; Analyze</b> — Keys-stadi va tahlil\n"
                                "• <b>Think &amp; Lead</b> — Yetakchilik va boshqaruv\n"
                                "• <b>Think &amp; Create</b> — Yangi g'oyalar va innovatsiya\n"
                                "• <b>Think &amp; Connect</b> — Professional tarmoq\n\n"
                                "Topshiriqlarni ko'rish va ishlarni topshirish uchun Mini App'ni oching:"
                            )
                            keyboard = {
                                "inline_keyboard": [[{
                                    "text": "🚀 ThinkSpace Mini App",
                                    "web_app": {"url": settings.MINI_APP_URL}
                                }]]
                            }
                            await client.post(f"{base_url}/sendMessage", json={
                                "chat_id": chat_id,
                                "text": reply_text,
                                "parse_mode": "HTML",
                                "reply_markup": keyboard
                            })
                            continue

                        # Case C: Application already pending
                        if user_status == UserStatus.PENDING.value and has_request:
                            reply_text = (
                                "⏳ <b>A'zolik arizangiz ko'rib chiqilmoqda!</b>\n\n"
                                f"👤 Ism-familiyangiz: <b>{html_escape(user.display_name)}</b>\n"
                                f"🏛 Fakultet/Guruh: <b>{html_escape(user.faculty or 'Belgilanmagan')}</b>\n\n"
                                "Klub ma'muriyati (Admin) arizangizni tasdiqlashi bilan sizga darhol xabarnoma yuboramiz.\n"
                                "Unga qadar platforma bilan tanishib turishingiz mumkin:"
                            )
                            keyboard = {
                                "inline_keyboard": [[{
                                    "text": "📱 Mini App'ni ko'rish",
                                    "web_app": {"url": settings.MINI_APP_URL}
                                }]]
                            }
                            await client.post(f"{base_url}/sendMessage", json={
                                "chat_id": chat_id,
                                "text": reply_text,
                                "parse_mode": "HTML",
                                "reply_markup": keyboard
                            })
                            continue

                        # Case D: New applicant -> Begin Step 1 (Ask full name)
                        user_steps[chat_id] = "ask_name"
                        reply_text = (
                            "🏛 <b>ThinkSpace | UWED intellektual klubiga xush kelibsiz!</b>\n\n"
                            "Klub a'zoligiga qabul qilinish uchun arizangizni rasmiylashtiramiz.\n\n"
                            "✍️ <b>1-qadam:</b> Iltimos, to'liq <b>Ism va Familiyangizni</b> yozib yuboring (masalan: <i>Ali Valiyev</i>):"
                        )
                        await client.post(f"{base_url}/sendMessage", json={
                            "chat_id": chat_id,
                            "text": reply_text,
                            "parse_mode": "HTML"
                        })
                        continue

                    # --- CONVERSATIONAL ONBOARDING FLOW ---
                    current_step = user_steps.get(chat_id)
                    
                    if current_step == "ask_name":
                        full_name = text.strip()
                        if len(full_name) < 3:
                            await client.post(f"{base_url}/sendMessage", json={
                                "chat_id": chat_id,
                                "text": "Iltimos, haqiqiy Ism va Familiyangizni to'liq kiriting (masalan: <i>Ali Valiyev</i>):",
                                "parse_mode": "HTML"
                            })
                            continue

                        with SessionLocal() as session:
                            u = get_user_by_telegram_id(session, user_tg_id)
                            if u:
                                u.display_name = full_name
                                parts = full_name.split()
                                u.first_name = parts[0]
                                u.last_name = " ".join(parts[1:]) if len(parts) > 1 else None
                                session.commit()

                        user_steps[chat_id] = "ask_faculty"
                        reply_text = (
                            f"Rahmat, <b>{html_escape(full_name)}</b>!\n\n"
                            "🎓 <b>2-qadam:</b> Endi <b>Fakultetingiz va Guruhingizni</b> kiriting (masalan: <i>SIEM 2-kurs 210-guruh</i>):"
                        )
                        await client.post(f"{base_url}/sendMessage", json={
                            "chat_id": chat_id,
                            "text": reply_text,
                            "parse_mode": "HTML"
                        })
                        continue

                    if current_step == "ask_faculty":
                        faculty_group = text.strip()
                        if len(faculty_group) < 3:
                            await client.post(f"{base_url}/sendMessage", json={
                                "chat_id": chat_id,
                                "text": "Iltimos, fakultet va guruhingizni to'liqroq kiriting (masalan: <i>SIEM 2-kurs 210-guruh</i>):",
                                "parse_mode": "HTML"
                            })
                            continue

                        with SessionLocal() as session:
                            u = get_user_by_telegram_id(session, user_tg_id)
                            if u:
                                submit_membership_request(
                                    session=session,
                                    user=u,
                                    statement="Telegram bot orqali ro'yxatdan o'tdi",
                                    chosen_directions=["Think & Read", "Think & Analyze"],
                                    faculty=faculty_group
                                )
                                u.status = UserStatus.PENDING.value
                                session.commit()
                                applicant_name = u.display_name
                            else:
                                applicant_name = "Talaba"

                        user_steps.pop(chat_id, None)
                        reply_text = (
                            "✅ <b>Arizangiz muvaffaqiyatli qabul qilindi!</b>\n\n"
                            "Sizning ma'lumotlaringiz klub boshqaruviga (Adminga) yuborildi.\n"
                            "Admin arizangizni tasdiqlaganidan so'ng sizga darhol xabarnoma keladi va barcha topshiriqlar ochiladi!\n\n"
                            "Platformani ko'rish uchun quyidagi tugmani bosing:"
                        )
                        keyboard = {
                            "inline_keyboard": [[{
                                "text": "🚀 ThinkSpace Mini App",
                                "web_app": {"url": settings.MINI_APP_URL}
                            }]]
                        }
                        await client.post(f"{base_url}/sendMessage", json={
                            "chat_id": chat_id,
                            "text": reply_text,
                            "parse_mode": "HTML",
                            "reply_markup": keyboard
                        })

                        # Notify Super Admin if configured
                        if settings.SUPER_ADMIN_TELEGRAM_ID > 0 and settings.SUPER_ADMIN_TELEGRAM_ID != chat_id:
                            admin_notify = (
                                "🔔 <b>Yangi a'zolik arizasi!</b>\n\n"
                                f"👤 Talaba: <b>{html_escape(applicant_name)}</b>\n"
                                f"🏛 Fakultet: <b>{html_escape(faculty_group)}</b>\n\n"
                                "Admin panel orqali tasdiqlang."
                            )
                            try:
                                await client.post(f"{base_url}/sendMessage", json={
                                    "chat_id": settings.SUPER_ADMIN_TELEGRAM_ID,
                                    "text": admin_notify,
                                    "parse_mode": "HTML"
                                })
                            except Exception:
                                pass
                        continue

                    # --- COMMAND: /help ---
                    if text.startswith("/help"):
                        help_text = (
                            "📚 <b>ThinkSpace | UWED Bot Buyruqlari</b>\n\n"
                            "• /start — Botni ishga tushirish va a'zolik\n"
                            "• /tasks — Faol topshiriqlar\n"
                            "• /leaderboard — Klub reytingi\n"
                            "• /profile — Sizning profilingiz\n"
                            "• /help — Yordam\n\n"
                            "Asosiy amallar va topshiriqlarni yuklash uchun Mini App'dan foydalaning:"
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
                        continue

                    # --- COMMAND: /tasks ---
                    if text.startswith("/tasks"):
                        with SessionLocal() as session:
                            stmt = select(Assignment).where(
                                Assignment.status.in_([AssignmentStatus.PUBLISHED.value, AssignmentStatus.OPEN.value])
                            )
                            tasks = session.execute(stmt).scalars().all()

                        if not tasks:
                            reply = "📌 Hozirda faol topshiriqlar mavjud emas."
                        else:
                            reply = "📝 <b>Faol Topshiriqlar:</b>\n\n"
                            for idx, t in enumerate(tasks, 1):
                                reply += f"{idx}. <b>{html_escape(t.title)}</b> ({html_escape(t.direction)}) — {t.max_score} ball\n"

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
                        continue

                    # --- COMMAND: /profile ---
                    if text.startswith("/profile"):
                        with SessionLocal() as session:
                            stmt = select(User).where(User.telegram_id == user_tg_id)
                            u = session.execute(stmt).scalar_one_or_none()
                            if not u:
                                reply = "Siz ro'yxatdan o'tmagansiz. /start buyrug'ini bosing."
                            else:
                                progress = calculate_member_progress(session, u.id)
                                roles_str = ", ".join([r.role_name for r in u.roles]) if u.roles else "A'zo"
                                reply = (
                                    "👤 <b>A'zo Profili:</b>\n"
                                    f"• Ism: <b>{html_escape(u.display_name)}</b>\n"
                                    f"• Holat: <b>{html_escape(u.status.capitalize())}</b>\n"
                                    f"• Rollar: <i>{html_escape(roles_str)}</i>\n\n"
                                    "📊 <b>Natijalar:</b>\n"
                                    f"• Jami ball: <b>{progress.total_points}</b>\n"
                                    f"• O'rtacha foiz: <b>{progress.average_percentage}%</b>\n"
                                    f"• Baholangan ishlar: <b>{progress.graded_assignments_count} ta</b>\n"
                                    f"• Ko'rib chiqilayotgan ishlar: <b>{progress.pending_reviews_count} ta</b>\n"
                                )
                        keyboard = {
                            "inline_keyboard": [[{
                                "text": "🔎 Batafsil (Mini App)",
                                "web_app": {"url": f"{settings.MINI_APP_URL}/progress"}
                            }]]
                        }
                        await client.post(f"{base_url}/sendMessage", json={
                            "chat_id": chat_id,
                            "text": reply,
                            "parse_mode": "HTML",
                            "reply_markup": keyboard
                        })
                        continue

                    # Default fallback
                    await client.post(f"{base_url}/sendMessage", json={
                        "chat_id": chat_id,
                        "text": "Platformani ochish uchun quyidagi tugmani bosing yoki /start yuboring:",
                        "reply_markup": {
                            "inline_keyboard": [[{
                                "text": "🚀 ThinkSpace Mini App",
                                "web_app": {"url": settings.MINI_APP_URL}
                            }]]
                        }
                    })

            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[bot] Polling loop notice: {e}")
                await asyncio.sleep(2)

async def start_bot():
    """Main entrypoint for starting the Telegram bot."""
    print("[bot] Initializing ThinkSpace | UWED Telegram Bot...")
    
    if not settings.TELEGRAM_BOT_TOKEN or settings.TELEGRAM_BOT_TOKEN.startswith("dummy_"):
        print("[bot] TELEGRAM_BOT_TOKEN is not configured with a live token.")
        return False

    try:
        create_tables()
    except Exception as e:
        print(f"[bot] create_tables notice: {e}")

    # Pure Python HTTP long-polling runner:
    # 100% resilient, no signal conflicts with uvicorn, handles step-by-step onboarding
    await run_httpx_polling(settings.TELEGRAM_BOT_TOKEN)
    return True
