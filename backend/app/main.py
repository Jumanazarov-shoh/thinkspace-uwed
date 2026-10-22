"""
ThinkSpace | UWED — Unified Backend Entrypoint
FastAPI application with CORS, database initialization, and static file serving.
"""
from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import create_tables
from app.api import api_router

import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    try:
        create_tables()
    except Exception as e:
        print(f"[lifespan] create_tables notice: {e}")

    # Launch background Telegram bot runner if configured
    bot_task = None
    if settings.TELEGRAM_BOT_TOKEN and not settings.TELEGRAM_BOT_TOKEN.startswith("dummy_"):
        try:
            from app.bot.runner import start_bot
            bot_task = asyncio.create_task(start_bot())
            print("[lifespan] Background Telegram bot task launched.")
        except Exception as e:
            print(f"[lifespan] Could not launch Telegram bot: {e}")

    # Periodic background reminder processor (every 30 minutes)
    async def periodic_reminders():
        while True:
            try:
                await asyncio.sleep(1800)
                from app.database import SessionLocal
                from app.services.notification_service import process_deadline_reminders
                with SessionLocal() as db:
                    res = process_deadline_reminders(session=db)
                    print(f"[lifespan] Processed deadline reminders: {res}")
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[lifespan] Periodic reminder processor notice: {e}")

    reminder_task = asyncio.create_task(periodic_reminders())

    yield

    if bot_task:
        bot_task.cancel()
    if reminder_task:
        reminder_task.cancel()

app = FastAPI(
    title=settings.APP_NAME,
    description="Unified API for ThinkSpace | UWED Telegram Bot, Mini App, and Multi-Admin Evaluation Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# If built frontend exists, mount it at /app for unified preview
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/app", StaticFiles(directory=frontend_dist, html=True), name="frontend_app")

app.include_router(api_router)

@app.get("/health")
def liveness_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT
    }

@app.get("/")
def root():
    return {
        "message": "ThinkSpace | UWED Platform API is running.",
        "docs": "/docs",
        "health": "/api/health",
        "club": "School of International Economics and Management, UWED/JIDU",
        "directions": [
            "Think & Read",
            "Think & Discuss",
            "Think & Analyze",
            "Think & Lead",
            "Think & Create",
            "Think & Connect"
        ]
    }
