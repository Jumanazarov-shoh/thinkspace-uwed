"""
Telegram Bot /start handler with onboarding and Mini App launching.
"""
try:
    from aiogram import Router, types
    from aiogram.filters import CommandStart
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
    AIOGRAM_AVAILABLE = True
except Exception:
    AIOGRAM_AVAILABLE = False
    class DummyRouter:
        def __init__(self, *args, **kwargs): pass
        def message(self, *args, **kwargs):
            return lambda fn: fn
    Router = DummyRouter
    CommandStart = lambda *args, **kwargs: None
    types = type("types", (), {"Message": object})
    InlineKeyboardMarkup = InlineKeyboardButton = WebAppInfo = None

from app.config import settings
from app.database import SessionLocal
from app.models.user import UserStatus, RoleEnum
from app.services.user_service import get_or_create_user_from_telegram

router = Router(name="start")

@router.message(CommandStart())
async def handle_start(message: types.Message):
    tg_user = message.from_user
    if not tg_user:
        return

    with SessionLocal() as session:
        user = get_or_create_user_from_telegram(
            session=session,
            telegram_id=tg_user.id,
            first_name=tg_user.first_name,
            last_name=tg_user.last_name,
            username=tg_user.username,
            preferred_language=tg_user.language_code or "uz"
        )
        session.commit()
        session.refresh(user)

        user_status = user.status
        is_admin = user.has_role(RoleEnum.SUPER_ADMIN.value) or user.has_role(RoleEnum.MODERATOR.value)

    # Build welcoming academic message with properly escaped HTML
    welcome_header = (
        f"🏛 <b>ThinkSpace | UWED</b>\n"
        f"<i>Xalqaro iqtisodiyot va menejment fakulteti intellektual klubi</i>\n\n"
        f"Assalomu alaykum, <b>{tg_user.first_name}</b>!\n\n"
        f"Klubimiz 6 ta asosiy yo'nalish bo'yicha ilmiy va amaliy ko'nikmalarni rivojlantiradi:\n"
        f"• <b>Think &amp; Read</b> — Kitob va tahliliy maqolalar sharhi\n"
        f"• <b>Think &amp; Discuss</b> — Debatlar va intellektual muloqot\n"
        f"• <b>Think &amp; Analyze</b> — Keys-stadi va zamonaviy tahlil\n"
        f"• <b>Think &amp; Lead</b> — Yetakchilik va jamoaviy boshqaruv\n"
        f"• <b>Think &amp; Create</b> — Yangi g'oyalar va innovatsion loyihalar\n"
        f"• <b>Think &amp; Connect</b> — Professional tarmoq va hamkorlik\n\n"
    )

    # Mini App Launch Button
    mini_app_btn = InlineKeyboardButton(
        text="🚀 ThinkSpace Mini App",
        web_app=WebAppInfo(url=settings.MINI_APP_URL)
    )

    if user_status == UserStatus.APPROVED.value:
        status_text = (
            "✅ Siz klubning rasmiy a'zosisiz!\n"
            "Topshiriqlarni ko'rish, ishlarni yuklash va reytingingizni bilish uchun quyidagi tugmani bosing:"
        )
    elif user_status == UserStatus.PENDING.value:
        status_text = (
            "⏳ Sizning a'zolik arizangiz kutilmoqda.\n"
            "Mini App orqali arizangiz holatini tekshirishingiz yoki ma'lumotlaringizni to'ldirishingiz mumkin:"
        )
    else:
        status_text = "Mini App ilovamiz orqali platformaga kiring:"

    keyboard = InlineKeyboardMarkup(inline_keyboard=[[mini_app_btn]])
    await message.answer(welcome_header + status_text, reply_markup=keyboard)
