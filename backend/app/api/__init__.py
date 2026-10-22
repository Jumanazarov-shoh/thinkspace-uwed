"""
API router aggregator.
"""
from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.members import router as members_router
from app.api.assignments import router as assignments_router
from app.api.submissions import router as submissions_router
from app.api.evaluations import router as evaluations_router
from app.api.moderation import router as moderation_router
from app.api.leaderboard import router as leaderboard_router
from app.api.health import router as health_router
from app.api.notifications import router as notifications_router
from app.api.analytics import router as analytics_router

api_router = APIRouter(prefix="/api")

api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(members_router)
api_router.include_router(assignments_router)
api_router.include_router(submissions_router)
api_router.include_router(evaluations_router)
api_router.include_router(moderation_router)
api_router.include_router(leaderboard_router)
api_router.include_router(notifications_router)
api_router.include_router(analytics_router)
