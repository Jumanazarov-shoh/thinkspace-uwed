"""
Resilient runner for ThinkSpace | UWED Telegram Bot.
Supports conversational membership application (name -> course -> faculty -> motivation -> admin approval),
direct task viewing (/tasks), task submission via Telegram, callback queries, and resilient polling.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from sqlalchemy import select
from app.config import settings
from app.database import create_tables, SessionLocal
from app.models.user import User, UserStatus, RoleEnum, MembershipRequest
from app.models.assignment import Assignment, AssignmentStatus
from app.models.submission import Submission, SubmissionVersion, StoredFile, SubmissionStatus
from app.services.user_service import (
    get_or_create_user_from_telegram,
    get_user_by_telegram_id,
    submit_membership_request
)
from app.services.leaderboard_service import calculate_member_progress

logger = logging.getLogger("thinkspace.bot")

def html_escape(s: Any) -> str:
    """Escapes HTML special characters for Telegram Bot API HTML parse mode."""
    if s is None:
        return ""
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def format_deadline(dt: Optional[datetime]) -> str:
    if not dt:
        return "Muddati belgilanmagan"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    tashkent_tz = timezone(timedelta(hours=5))
    return dt.astimezone(tashkent_tz).strftime("%d.%m.%Y %H:%M")

async def run_httpx_polling(token: str):
    """
    Pure-Python HTTP polling runner for Telegram Bot API.
    Zero native DLL dependencies, works reliably inside FastAPI lifespan.
    Handles:
    1. Onboarding questionnaire (name -> course -> faculty -> motivation)
    2. /tasks and task browsing
    3. Direct assignment submissions via Telegram
    4. Profile and leaderboard queries
    """
    import httpx

    base_url = f"https://api.telegram.org/bot{token}"
    
    # State tracking:
    # user_onboarding[chat_id] = { "step": "...", "name": "...", "course": "...", "faculty": "..." }
    user_onboarding: Dict[int, Dict[str, Any]] = {}
    # user_submitting_task[chat_id] = task_id
    user_submitting_task: Dict[int, int] = {}

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
                    json={"offset": offset, "timeout": 20, "allowed_updates": ["message", "callback_query"]}
                )
                if res.status_code != 200:
                    await asyncio.sleep(2)
                    continue

                updates = res.json().get("result", [])

                for update in updates:
                    offset = max(offset, update["update_id"] + 1)

                    # --- HANDLE CALLBACK QUERIES ---
                    callback_query = update.get("callback_query")
                    if callback_query:
                        cb_id = callback_query["id"]
                        cb_data = callback_query.get("data", "")
                        cb_chat_id = callback_query["message"]["chat"]["id"]
                        cb_user_tg_id = callback_query["from"]["id"]

                        # Acknowledge callback immediately
                        try:
                            await client.post(f"{base_url}/answerCallbackQuery", json={"callback_query_id": cb_id})
                        except Exception:
                            pass

                        # Handle Course Selection Callback
                        if cb_data.startswith("course_"):
                            course_val = cb_data.replace("course_", "").replace("_", " ")
                            if cb_chat_id in user_onboarding and user_onboarding[cb_chat_id].get("step") == "ask_course":
                                user_onboarding[cb_chat_id]["course"] = course_val
                                user_onboarding[cb_chat_id]["step"] = "ask_faculty"

                                await client.post(f"{base_url}/sendMessage", json={
                                    "chat_id": cb_chat_id,
                                    "text": (
                                        f"Tanlangan bosqich: <b>{html_escape(course_val)}</b>\n\n"
                                        "🏢 <b>3-qadam:</b> Fakultetingiz va guruhingizni kiriting\n"
                                        "(masalan: <i>SIEM 210-guruh</i> yoki <i>Xalqaro Huquq 104-guruh</i>):"
                                    ),
                                    "parse_mode": "HTML"
                                })
                            continue

                        # Handle Task Submission Initiation Callback
                        if cb_data.startswith("submit_task_"):
                            task_id_str = cb_data.replace("submit_task_", "")
                            try:
                                task_id = int(task_id_str)
                                with SessionLocal() as session:
                                    t = session.get(Assignment, task_id)
                                    u = get_user_by_telegram_id(session, cb_user_tg_id)

                                if not u or u.status != UserStatus.APPROVED.value:
                                    await client.post(f"{base_url}/sendMessage", json={
                                        "chat_id": cb_chat_id,
                                        "text": "⚠️ Topshiriq topshirish uchun avval a'zolik arizangiz ma'muriyat tomonidan tasdiqlanishi kerak."
                                    })
                                    continue

                                if not t:
                                    await client.post(f"{base_url}/sendMessage", json={
                                        "chat_id": cb_chat_id,
                                        "text": "Topshiriq topilmadi."
                                    })
                                    continue

                                user_submitting_task[cb_chat_id] = task_id
                                prompt_text = (
                                    f"✍️ <b>'{html_escape(t.title)}'</b> topshirig'i bo'yicha javob yuborish:\n\n"
                                    f"📁 Yo'nalish: <b>{html_escape(t.direction)}</b>\n"
                                    f"⏰ Muddat: <b>{format_deadline(t.deadline_at)}</b>\n\n"
                                    "Iltimos, o'z ishingizni (insho, tahliliy matn yoki Google Docs/havola) shu yerga <b>bitta xabar</b> sifatida yozib yuboring.\n\n"
                                    "<i>(Bekor qilish uchun /cancel deb yozing)</i>"
                                )
                                await client.post(f"{base_url}/sendMessage", json={
                                    "chat_id": cb_chat_id,
                                    "text": prompt_text,
                                    "parse_mode": "HTML"
                                })
                            except Exception as e:
                                print(f"[bot] Error starting task submission: {e}")
                            continue

                    # --- HANDLE REGULAR MESSAGES ---
                    message = update.get("message")
                    if not message:
                        continue

                    chat_id = message["chat"]["id"]
                    text = message.get("text", "").strip()
                    tg_user = message.get("from", {})
                    user_tg_id = tg_user.get("id") or chat_id

                    # Check for cancellation
                    if text == "/cancel":
                        user_onboarding.pop(chat_id, None)
                        user_submitting_task.pop(chat_id, None)
                        await client.post(f"{base_url}/sendMessage", json={
                            "chat_id": chat_id,
                            "text": "Jarayon bekor qilindi. Bosh menyu uchun /start bosing."
                        })
                        continue

                    # --- HANDLE TASK SUBMISSION FLOW ---
                    if chat_id in user_submitting_task:
                        task_id = user_submitting_task[chat_id]
                        
                        # Extract submission content: text, document caption, or link
                        submission_text = text or message.get("caption", "")
                        has_doc = "document" in message
                        file_id = message["document"]["file_id"] if has_doc else None
                        file_name = message["document"].get("file_name", "telegram_file") if has_doc else None

                        if not submission_text and not has_doc:
                            await client.post(f"{base_url}/sendMessage", json={
                                "chat_id": chat_id,
                                "text": "Iltimos, matn, havola yoki fayl yuboring (bekor qilish uchun /cancel):"
                            })
                            continue

                        with SessionLocal() as session:
                            t = session.get(Assignment, task_id)
                            u = get_user_by_telegram_id(session, user_tg_id)

                            if not t or not u:
                                user_submitting_task.pop(chat_id, None)
                                continue

                            # Check for existing submission
                            existing_sub = session.execute(
                                select(Submission).where(
                                    Submission.assignment_id == task_id,
                                    Submission.user_id == u.id
                                )
                            ).scalar_one_or_none()

                            now_utc = datetime.now(timezone.utc)
                            is_late = False
                            if t.deadline_at:
                                dead = t.deadline_at if t.deadline_at.tzinfo else t.deadline_at.replace(tzinfo=timezone.utc)
                                is_late = now_utc > dead

                            if existing_sub:
                                ver_num = len(existing_sub.versions) + 1
                                sub = existing_sub
                                sub.status = SubmissionStatus.SUBMITTED.value
                                sub.review_status = "awaiting_evaluation"
                                sub.is_late = is_late
                                sub.submitted_at = now_utc
                            else:
                                sub = Submission(
                                    assignment_id=task_id,
                                    user_id=u.id,
                                    status=SubmissionStatus.SUBMITTED.value,
                                    review_status="awaiting_evaluation",
                                    is_late=is_late,
                                    submitted_at=now_utc
                                )
                                session.add(sub)
                                session.flush()
                                ver_num = 1

                            version = SubmissionVersion(
                                submission_id=sub.id,
                                version_number=ver_num,
                                text_content=submission_text if submission_text else f"[Fayl yuborildi: {file_name}]",
                                submitted_at=now_utc
                            )
                            session.add(version)
                            session.flush()
                            sub.current_version_id = version.id

                            if has_doc and file_id:
                                stored = StoredFile(
                                    submission_version_id=version.id,
                                    original_filename=file_name,
                                    storage_path=f"telegram://{file_id}",
                                    mime_type=message["document"].get("mime_type", "application/octet-stream"),
                                    file_size_bytes=message["document"].get("file_size", 0),
                                    telegram_file_id=file_id,
                                    uploaded_at=now_utc
                                )
                                session.add(stored)

                            session.commit()
                            task_title = t.title

                        user_submitting_task.pop(chat_id, None)

                        late_note = " <i>(Muddatidan kechiktirildi)</i>" if is_late else ""
                        confirm_text = (
                            "🎉 <b>Topshirig'ingiz muvaffaqiyatli qabul qilindi!</b>\n\n"
                            f"📌 Topshiriq: <b>{html_escape(task_title)}</b>\n"
                            f"🕒 Vaqt: <b>{format_deadline(datetime.now(timezone.utc))}</b>{late_note}\n\n"
                            "Ishingiz baholovchilar maydoniga (Workspace) yuborildi. Baholangach, sizga natija haqida xabar beriladi!"
                        )
                        keyboard = {
                            "inline_keyboard": [[{
                                "text": "🚀 Mini App'da tekshirish",
                                "web_app": {"url": settings.MINI_APP_URL}
                            }]]
                        }
                        await client.post(f"{base_url}/sendMessage", json={
                            "chat_id": chat_id,
                            "text": confirm_text,
                            "parse_mode": "HTML",
                            "reply_markup": keyboard
                        })
                        continue

                    # --- COMMAND: /start ---
                    if text.startswith("/start"):
                        user_onboarding.pop(chat_id, None)
                        user_submitting_task.pop(chat_id, None)

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
                            # Check if user has an actual submitted request
                            has_request = any(r.status == UserStatus.PENDING.value for r in user.membership_requests)

                        # Case A: Super Admin
                        if is_super_admin:
                            reply_text = (
                                "🏛 <b>ThinkSpace | UWED</b>\n\n"
                                f"👑 Assalomu alaykum, <b>{html_escape(user.display_name)}</b>!\n\n"
                                "Siz platformaning <b>Bosh Administratori</b> (Super Admin) sifatida faoliyat yuritmoqdasiz.\n"
                                "Talabalarni tasdiqlash, xabar yuborish va topshiriqlarni boshqarish uchun Admin panelni oching:"
                            )
                            keyboard = {
                                "inline_keyboard": [[{
                                    "text": "🛡️ ThinkSpace Boshqaruv Paneli",
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
                                "Bot orqali quyidagi buyruqlardan foydalanishingiz mumkin:\n"
                                "• <b>/tasks</b> — Faol topshiriqlarni ko'rish va topshirish\n"
                                "• <b>/profile</b> — O'z natijangiz va ballaringizni tekshirish\n"
                                "• <b>/help</b> — Yordam va ko'rsatmalar\n\n"
                                "Yoki barcha imkoniyatlar uchun Mini App'ni oching:"
                            )
                            keyboard = {
                                "inline_keyboard": [
                                    [{"text": "📋 Faol Vazifalar", "callback_data": "menu_tasks"}],
                                    [{"text": "🚀 ThinkSpace Mini App", "web_app": {"url": settings.MINI_APP_URL}}]
                                ]
                            }
                            await client.post(f"{base_url}/sendMessage", json={
                                "chat_id": chat_id,
                                "text": reply_text,
                                "parse_mode": "HTML",
                                "reply_markup": keyboard
                            })
                            continue

                        # Case C: Application already pending review
                        if user_status == UserStatus.PENDING.value and has_request:
                            reply_text = (
                                "⏳ <b>A'zolik arizangiz ko'rib chiqilmoqda!</b>\n\n"
                                f"👤 Ism-familiyangiz: <b>{html_escape(user.display_name)}</b>\n"
                                f"🏛 Fakultet/Guruh: <b>{html_escape(user.faculty or 'Belgilanmagan')}</b>\n\n"
                                "Klub ma'muriyati (Admin) arizangizni tasdiqlashi bilan sizga darhol shu yerda xabarnoma keladi!\n"
                                "Unga qadar platforma tuzilishi bilan tanishib turishingiz mumkin:"
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
                        user_onboarding[chat_id] = {"step": "ask_name"}
                        reply_text = (
                            "🏛 <b>ThinkSpace | UWED intellektual klubiga xush kelibsiz!</b>\n\n"
                            "Klub a'zoligiga qabul qilinish uchun arizangizni rasmiylashtiramiz.\n\n"
                            "✍️ <b>1-qadam:</b> Iltimos, to'liq <b>Ism va Familiyangizni</b> kiriting (masalan: <i>Ali Valiyev</i>):"
                        )
                        await client.post(f"{base_url}/sendMessage", json={
                            "chat_id": chat_id,
                            "text": reply_text,
                            "parse_mode": "HTML"
                        })
                        continue

                    # --- CONVERSATIONAL ONBOARDING FLOW ---
                    if chat_id in user_onboarding:
                        current_step = user_onboarding[chat_id].get("step")

                        # Step 1: Process Full Name -> Ask Course
                        if current_step == "ask_name":
                            full_name = text.strip()
                            if len(full_name) < 3 or len(full_name.split()) < 2:
                                await client.post(f"{base_url}/sendMessage", json={
                                    "chat_id": chat_id,
                                    "text": "Iltimos, Ism va Familiyangizni to'liq kiriting (masalan: <i>Ali Valiyev</i>):",
                                    "parse_mode": "HTML"
                                })
                                continue

                            user_onboarding[chat_id]["name"] = full_name
                            user_onboarding[chat_id]["step"] = "ask_course"

                            keyboard = {
                                "inline_keyboard": [
                                    [{"text": "1-kurs", "callback_data": "course_1-kurs"}, {"text": "2-kurs", "callback_data": "course_2-kurs"}],
                                    [{"text": "3-kurs", "callback_data": "course_3-kurs"}, {"text": "4-kurs", "callback_data": "course_4-kurs"}],
                                    [{"text": "Magistratura", "callback_data": "course_Magistratura"}]
                                ]
                            }
                            await client.post(f"{base_url}/sendMessage", json={
                                "chat_id": chat_id,
                                "text": f"Rahmat, <b>{html_escape(full_name)}</b>!\n\n🎓 <b>2-qadam:</b> Nechanchi kursda o'qiysiz? Tugmalardan birini tanlang:",
                                "parse_mode": "HTML",
                                "reply_markup": keyboard
                            })
                            continue

                        # Step 2: Course entered via text (fallback) -> Ask Faculty
                        if current_step == "ask_course":
                            course_val = text.strip()
                            user_onboarding[chat_id]["course"] = course_val
                            user_onboarding[chat_id]["step"] = "ask_faculty"

                            await client.post(f"{base_url}/sendMessage", json={
                                "chat_id": chat_id,
                                "text": (
                                    "🏢 <b>3-qadam:</b> Endi <b>Fakultetingiz va guruhingizni</b> kiriting\n"
                                    "(masalan: <i>SIEM 210-guruh</i> yoki <i>Xalqaro huquq 104-guruh</i>):"
                                ),
                                "parse_mode": "HTML"
                            })
                            continue

                        # Step 3: Faculty & Group -> Ask Motivation / Direction
                        if current_step == "ask_faculty":
                            faculty_group = text.strip()
                            if len(faculty_group) < 2:
                                await client.post(f"{base_url}/sendMessage", json={
                                    "chat_id": chat_id,
                                    "text": "Iltimos, fakultet va guruhingizni to'liqroq yozing (masalan: <i>SIEM 210-guruh</i>):",
                                    "parse_mode": "HTML"
                                })
                                continue

                            user_onboarding[chat_id]["faculty"] = faculty_group
                            user_onboarding[chat_id]["step"] = "ask_motivation"

                            await client.post(f"{base_url}/sendMessage", json={
                                "chat_id": chat_id,
                                "text": (
                                    "💡 <b>4-qadam:</b> Nima sababdan <b>ThinkSpace</b> klubiga a'zo bo'lmoqchisiz?\n"
                                    "Qaysi yo'nalishlar sizga ko'proq qiziq? <i>(Qisqacha motivatsiyangizni yozing)</i>:"
                                ),
                                "parse_mode": "HTML"
                            })
                            continue

                        # Step 4: Motivation -> Complete Application!
                        if current_step == "ask_motivation":
                            statement = text.strip()
                            if len(statement) < 5:
                                statement = "Klub a'zosi bo'lish va ilmiy loyihalarda qatnashish niyatidaman."

                            data = user_onboarding.pop(chat_id, {})
                            full_name = data.get("name", tg_user.get("first_name", "Student"))
                            course = data.get("course", "Talaba")
                            faculty = data.get("faculty", "SIEM")
                            full_faculty = f"{faculty} ({course})"

                            with SessionLocal() as session:
                                u = get_user_by_telegram_id(session, user_tg_id)
                                if u:
                                    u.display_name = full_name
                                    parts = full_name.split()
                                    u.first_name = parts[0]
                                    u.last_name = " ".join(parts[1:]) if len(parts) > 1 else None
                                    u.faculty = full_faculty
                                    u.status = UserStatus.PENDING.value

                                    req = submit_membership_request(
                                        session=session,
                                        user=u,
                                        statement=statement,
                                        chosen_directions=["Think & Read", "Think & Analyze"],
                                        faculty=full_faculty
                                    )
                                    session.commit()
                                    session.refresh(req)

                            reply_text = (
                                "✅ <b>Arizangiz muvaffaqiyatli qabul qilindi!</b>\n\n"
                                f"👤 Ism-familiya: <b>{html_escape(full_name)}</b>\n"
                                f"🎓 Bosqich: <b>{html_escape(course)}</b>\n"
                                f"🏢 Fakultet/Guruh: <b>{html_escape(faculty)}</b>\n\n"
                                "Ma'lumotlaringiz klub boshqaruviga (Adminga) yuborildi.\n"
                                "Admin arizangizni tasdiqlashi bilan sizga <b>avtomatik xabarnoma</b> keladi!"
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

                            # Notify Super Admin in Telegram
                            if settings.SUPER_ADMIN_TELEGRAM_ID > 0 and settings.SUPER_ADMIN_TELEGRAM_ID != chat_id:
                                admin_alert = (
                                    "🔔 <b>Yangi a'zolik arizasi keldi!</b>\n\n"
                                    f"👤 Talaba: <b>{html_escape(full_name)}</b>\n"
                                    f"🎓 Kurs: <b>{html_escape(course)}</b>\n"
                                    f"🏛 Fakultet: <b>{html_escape(faculty)}</b>\n"
                                    f"📝 Motivatsiya: <i>\"{html_escape(statement)}\"</i>\n\n"
                                    "Admin panel orqali arizani tasdiqlashingiz yoki rad etishingiz mumkin."
                                )
                                try:
                                    await client.post(f"{base_url}/sendMessage", json={
                                        "chat_id": settings.SUPER_ADMIN_TELEGRAM_ID,
                                        "text": admin_alert,
                                        "parse_mode": "HTML"
                                    })
                                except Exception:
                                    pass
                            continue

                    # --- COMMAND: /tasks ---
                    if text.startswith("/tasks") or text == "menu_tasks":
                        with SessionLocal() as session:
                            u = get_user_by_telegram_id(session, user_tg_id)
                            is_approved = u and (u.status == UserStatus.APPROVED.value or u.has_role(RoleEnum.SUPER_ADMIN.value))

                            stmt = select(Assignment).where(
                                Assignment.status.in_([AssignmentStatus.PUBLISHED.value, AssignmentStatus.OPEN.value])
                            ).order_by(Assignment.created_at.desc())
                            tasks = session.execute(stmt).scalars().all()

                        if not is_approved:
                            await client.post(f"{base_url}/sendMessage", json={
                                "chat_id": chat_id,
                                "text": "⏳ Topshiriqlarni ko'rish va topshirish uchun a'zolik arizangiz tasdiqlanishi kerak. Iltimos, admin tasdiqlashini kuting."
                            })
                            continue

                        if not tasks:
                            await client.post(f"{base_url}/sendMessage", json={
                                "chat_id": chat_id,
                                "text": "📌 Hozirda faol topshiriqlar mavjud emas. Yangi vazifa e'lon qilinganda shu yerda xabar beramiz!"
                            })
                            continue

                        for t in tasks:
                            desc_preview = t.description[:250] + "..." if len(t.description) > 250 else t.description
                            task_msg = (
                                f"📝 <b>{html_escape(t.title)}</b>\n\n"
                                f"📁 Yo'nalish: <b>{html_escape(t.direction)}</b>\n"
                                f"⏰ Muddat: <b>{format_deadline(t.deadline_at)}</b>\n"
                                f"🎯 Maksimal ball: <b>{t.max_score} ball</b>\n\n"
                                f"📖 <i>{html_escape(desc_preview)}</i>"
                            )
                            inline_keyboard = [
                                [
                                    {"text": "✍️ Ishni topshirish", "callback_data": f"submit_task_{t.id}"},
                                    {"text": "📱 Mini App'da ochish", "web_app": {"url": settings.MINI_APP_URL}}
                                ]
                            ]
                            await client.post(f"{base_url}/sendMessage", json={
                                "chat_id": chat_id,
                                "text": task_msg,
                                "parse_mode": "HTML",
                                "reply_markup": {"inline_keyboard": inline_keyboard}
                            })
                        continue

                    # --- COMMAND: /profile ---
                    if text.startswith("/profile"):
                        with SessionLocal() as session:
                            u = get_user_by_telegram_id(session, user_tg_id)
                            if not u:
                                reply = "Siz ro'yxatdan o'tmagansiz. /start buyrug'ini bosing."
                            else:
                                progress = calculate_member_progress(session, u.id)
                                roles_str = ", ".join([r.role_name for r in u.roles]) if u.roles else "A'zo"
                                reply = (
                                    "👤 <b>A'zo Profili:</b>\n"
                                    f"• Ism: <b>{html_escape(u.display_name)}</b>\n"
                                    f"• Fakultet: <b>{html_escape(u.faculty or 'SIEM')}</b>\n"
                                    f"• Holat: <b>{html_escape(u.status.capitalize())}</b>\n"
                                    f"• Rollar: <i>{html_escape(roles_str)}</i>\n\n"
                                    "📊 <b>Natijalar:</b>\n"
                                    f"• Jami ball: <b>{progress.total_points} ball</b>\n"
                                    f"• O'rtacha ko'rsatkich: <b>{progress.average_percentage}%</b>\n"
                                    f"• Baholangan ishlar: <b>{progress.graded_assignments_count} ta</b>\n"
                                    f"• Kutilayotgan ishlar: <b>{progress.pending_reviews_count} ta</b>\n"
                                )
                        keyboard = {
                            "inline_keyboard": [[{
                                "text": "🔎 Batafsil (Mini App)",
                                "web_app": {"url": settings.MINI_APP_URL}
                            }]]
                        }
                        await client.post(f"{base_url}/sendMessage", json={
                            "chat_id": chat_id,
                            "text": reply,
                            "parse_mode": "HTML",
                            "reply_markup": keyboard
                        })
                        continue

                    # --- COMMAND: /help ---
                    if text.startswith("/help"):
                        help_text = (
                            "📚 <b>ThinkSpace | UWED Bot Buyruqlari</b>\n\n"
                            "• <b>/start</b> — Botni ishga tushirish yoki arizani yangilash\n"
                            "• <b>/tasks</b> — Barcha faol topshiriqlarni ko'rish va topshirish\n"
                            "• <b>/profile</b> — Shaxsiy natija va ballarni tekshirish\n"
                            "• <b>/cancel</b> — Har qanday joriy amalni bekor qilish\n"
                            "• <b>/help</b> — Ushbu yordam xabari\n\n"
                            "Topshiriqlarni to'liq interaktiv interfeysda ko'rish uchun Mini App'dan foydalaning:"
                        )
                        keyboard = {
                            "inline_keyboard": [[{
                                "text": "📱 ThinkSpace Mini App",
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

                    # Default fallback message
                    await client.post(f"{base_url}/sendMessage", json={
                        "chat_id": chat_id,
                        "text": "Xush kelibsiz! Buyruqlar ro'yxatini ko'rish uchun /help bosing yoki Mini App'ni oching:",
                        "reply_markup": {
                            "inline_keyboard": [
                                [{"text": "📋 Faol Vazifalar", "callback_data": "menu_tasks"}],
                                [{"text": "🚀 ThinkSpace Mini App", "web_app": {"url": settings.MINI_APP_URL}}]
                            ]
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

    await run_httpx_polling(settings.TELEGRAM_BOT_TOKEN)
    return True
