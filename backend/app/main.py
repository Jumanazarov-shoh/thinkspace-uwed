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

@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    create_tables()
    yield

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
