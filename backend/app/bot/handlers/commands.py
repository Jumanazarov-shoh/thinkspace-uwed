"""
Telegram Bot helper commands: /help, /tasks, /profile, /leaderboard.
"""
from aiogram import Router, types
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from sqlalchemy import select
from app.config import settings
from app.database import SessionLocal
from app.models.user import User
from app.models.assignment import Assignment, AssignmentStatus
from app.services.leaderboard_service import calculate_leaderboard, calculate_member_progress

router = Router(name="commands")

@router.message(Command("help"))
async def handle_help(message: types.Message):
    text = (
        "📚 <b>ThinkSpace | UWED Bot Buyruqlari</b>\n\n"
        "• /start — Botni ishga tushirish va asosiy menyu\n"
        "• /tasks — Faol topshiriqlar ro'yxati\n"
        "• /leaderboard — Klub reyting jadvali\n"
        "• /profile — Sizning shaxsiy profilingiz va ballaringiz\n"
        "• /help — Ushbu yordam xabari\n\n"
        "Barcha asosiy amallar va ishlarni yuborish uchun Mini App'dan foydalaning."
    )
    btn = InlineKeyboardButton(text="📱 Mini App'ni ochish", web_app=WebAppInfo(url=settings.MINI_APP_URL))
    await message.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=[[btn]]))

@router.message(Command("tasks"))
async def handle_tasks(message: types.Message):
    with SessionLocal() as session:
        stmt = select(Assignment).where(Assignment.status == AssignmentStatus.OPEN.value).order_by(Assignment.deadline_at.asc())
        result = session.execute(stmt)
        tasks = result.scalars().all()

    if not tasks:
        text = "📌 Hozirda faol topshiriqlar mavjud emas. Yangi topshiriqlar e'lon qilinganda xabar beramiz!"
    else:
        text = "📝 <b>Faol Topshiriqlar:</b>\n\n"
        for idx, t in enumerate(tasks, start=1):
            dl = t.deadline_at.strftime("%d.%m.%Y %H:%M")
            text += f"{idx}. <b>{t.title}</b>\n   🏷 Yo'nalish: <i>{t.direction}</i>\n   ⏰ Muddat: <b>{dl}</b>\n   🎯 Maksimal ball: {t.max_score}\n\n"

    btn = InlineKeyboardButton(text="🚀 Topshirish (Mini App)", web_app=WebAppInfo(url=f"{settings.MINI_APP_URL}/tasks"))
    await message.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=[[btn]]))

@router.message(Command("profile"))
async def handle_profile(message: types.Message):
    tg_user = message.from_user
    if not tg_user:
        return

    with SessionLocal() as session:
        stmt = select(User).where(User.telegram_id == tg_user.id)
        result = session.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            await message.answer("Siz ro'yxatdan o'tmagansiz. /start buyrug'ini bosing.")
            return

        progress = calculate_member_progress(session, user.id)

    roles_str = ", ".join([r.role_name for r in user.roles]) if user.roles else "A'zo"
    text = (
        f"👤 <b>A'zo Profili:</b>\n"
        f"• Ism: <b>{user.display_name}</b>\n"
        f"• Holat: <b>{user.status.capitalize()}</b>\n"
        f"• Rollar: <i>{roles_str}</i>\n\n"
        f"📊 <b>Natijalar:</b>\n"
        f"• Jami ball: <b>{progress.total_points}</b>\n"
        f"• O'rtacha foiz: <b>{progress.average_percentage}%</b>\n"
        f"• Baholangan ishlar: <b>{progress.graded_assignments_count} ta</b>\n"
        f"• Ko'rib chiqilayotgan ishlar: <b>{progress.pending_reviews_count} ta</b>\n"
    )
    btn = InlineKeyboardButton(text="🔎 Batafsil (Mini App)", web_app=WebAppInfo(url=f"{settings.MINI_APP_URL}/progress"))
    await message.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=[[btn]]))

@router.message(Command("leaderboard"))
async def handle_leaderboard(message: types.Message):
    with SessionLocal() as session:
        top_entries = calculate_leaderboard(session, limit=5)

    if not top_entries:
        text = "🏆 <b>Klub Reytingi</b>\n\nHozircha e'lon qilingan baholar mavjud emas."
    else:
        text = "🏆 <b>ThinkSpace | UWED — Top A'zolar:</b>\n\n"
        medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]
        for idx, entry in enumerate(top_entries):
            medal = medals[idx] if idx < len(medals) else f"{idx+1}."
            text += f"{medal} <b>{entry.display_name}</b> — {entry.total_score} ball ({entry.average_percentage}%)\n"

    btn = InlineKeyboardButton(text="📊 To'liq reyting", web_app=WebAppInfo(url=f"{settings.MINI_APP_URL}/leaderboard"))
    await message.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=[[btn]]))
