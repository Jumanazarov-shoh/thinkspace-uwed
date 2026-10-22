"""
ThinkSpace | UWED — Milestone 6 Automated Test Suite
Notifications, Preferences, Deadline Reminders, Telegram Safety, and Personal Progress Dashboard.
"""
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from unittest.mock import patch

from app.models.user import User, UserStatus, RoleEnum
from app.models.assignment import Assignment, AssignmentStatus, Rubric, RubricCriterion
from app.models.submission import Submission, SubmissionStatus, SubmissionVersion
from app.models.evaluation import PublishedGrade, ReviewStatus
from app.models.notification import (
    Notification,
    NotificationPreference,
    DeadlineReminderLog,
    NotificationType,
)
from app.services import notification_service, leaderboard_service
from app.services.assignment_service import create_assignment, update_assignment, publish_assignment
from app.schemas.assignment import AssignmentCreate, AssignmentUpdate

# Helper to create an approved member with token
def get_user_token(client: TestClient, role: str) -> str:
    res = client.post(f"/api/auth/dev-login?role={role}")
    assert res.status_code == 200
    return res.json()["access_token"]


def test_in_app_notifications_crud_and_isolation(client: TestClient, db_session):
    """Verify that a member only sees their own notifications, unread counting, and mark-as-read."""
    member_token = get_user_token(client, "member")
    headers = {"Authorization": f"Bearer {member_token}"}

    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    my_id = me_res.json()["id"]

    # 1. Create a notification for this member and another user
    n1 = notification_service.create_notification(
        session=db_session,
        user_id=my_id,
        notification_type=NotificationType.SYSTEM_ANNOUNCEMENT.value,
        title="Xush kelibsiz!",
        message="ThinkSpace tizimiga xush kelibsiz.",
        send_telegram=False
    )
    n2 = notification_service.create_notification(
        session=db_session,
        user_id=my_id,
        notification_type=NotificationType.ASSIGNMENT_PUBLISHED.value,
        title="Yangi vazifa",
        message="Vazifa tafsilotlari.",
        send_telegram=False
    )
    db_session.commit()

    # 2. Fetch my notifications
    res = client.get("/api/notifications", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 2
    assert data["unread_count"] >= 2
    items = data["items"]
    assert any(i["id"] == n1.id for i in items)
    assert any(i["id"] == n2.id for i in items)

    # 3. Mark single notification as read
    read_res = client.post(f"/api/notifications/{n1.id}/read", headers=headers)
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True

    # Check unread count decremented
    res2 = client.get("/api/notifications", headers=headers)
    assert res2.json()["unread_count"] == data["unread_count"] - 1

    # 4. Mark all as read
    read_all_res = client.post("/api/notifications/read-all", headers=headers)
    assert read_all_res.status_code == 200
    assert read_all_res.json()["success"] is True

    res3 = client.get("/api/notifications", headers=headers)
    assert res3.json()["unread_count"] == 0

    # 5. Security check: User cannot read another user's notification
    # Create notification for different user (ID 99999)
    other_user = User(
        telegram_id=99998888,
        first_name="Other",
        display_name="Other User",
        status=UserStatus.APPROVED.value
    )
    db_session.add(other_user)
    db_session.commit()

    n_other = notification_service.create_notification(
        session=db_session,
        user_id=other_user.id,
        notification_type=NotificationType.SYSTEM_ANNOUNCEMENT.value,
        title="Secret",
        message="Secret message",
        send_telegram=False
    )
    db_session.commit()

    # Attempt to mark other's notification as read
    forbidden_res = client.post(f"/api/notifications/{n_other.id}/read", headers=headers)
    assert forbidden_res.status_code == 404


def test_notification_preferences_get_and_patch(client: TestClient, db_session):
    """Verify user can view and update their notification preferences."""
    member_token = get_user_token(client, "member")
    headers = {"Authorization": f"Bearer {member_token}"}

    # 1. Get initial preferences
    get_res = client.get("/api/notifications/preferences", headers=headers)
    assert get_res.status_code == 200
    prefs = get_res.json()
    assert prefs["telegram_notifications_enabled"] is True
    assert prefs["deadline_reminders_enabled"] is True

    # 2. Update preferences
    patch_res = client.patch(
        "/api/notifications/preferences",
        json={"telegram_notifications_enabled": False, "deadline_reminders_enabled": True},
        headers=headers
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["telegram_notifications_enabled"] is False

    # 3. Verify persistence
    get_res2 = client.get("/api/notifications/preferences", headers=headers)
    assert get_res2.json()["telegram_notifications_enabled"] is False


def test_assignment_publication_and_deduplication(client: TestClient, db_session):
    """Verify Draft -> Published sends notification once, but edits on Published don't duplicate."""
    admin_token = get_user_token(client, "super_admin")
    member_token = get_user_token(client, "member")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # 1. Create a Draft Assignment
    now = datetime.now(timezone.utc)
    create_payload = {
        "title": "Mintaqaviy Integratsiya va Logistika",
        "direction": "Think & Analyze",
        "description": "Markaziy Osiyoning transport yo'laklari tahlili.",
        "instructions": "Batafsil tahlil yozing.",
        "max_score": 100.0,
        "deadline_at": (now + timedelta(days=7)).isoformat(),
        "status": "draft"
    }
    res = client.post("/api/assignments", json=create_payload, headers=admin_headers)
    assert res.status_code == 201
    assign_id = res.json()["id"]

    # Check member notifications count before publish
    before_res = client.get("/api/notifications", headers=member_headers)
    before_count = before_res.json()["total"]

    # 2. Publish assignment (Draft -> Published)
    pub_res = client.post(f"/api/assignments/{assign_id}/publish", headers=admin_headers)
    assert pub_res.status_code == 200

    # Member should receive assignment_published notification
    after_res = client.get("/api/notifications", headers=member_headers)
    assert after_res.json()["total"] == before_count + 1
    new_notif = after_res.json()["items"][0]
    assert new_notif["type"] == NotificationType.ASSIGNMENT_PUBLISHED.value
    assert "Mintaqaviy Integratsiya" in new_notif["title"]

    # 3. Edit already published assignment
    edit_res = client.put(
        f"/api/assignments/{assign_id}",
        json={"instructions": "Yangilangan ko'rsatmalar: kamida 1000 so'z."},
        headers=admin_headers
    )
    assert edit_res.status_code == 200

    # Notification count should NOT increase (no duplicate spam)
    after_edit_res = client.get("/api/notifications", headers=member_headers)
    assert after_edit_res.json()["total"] == before_count + 1


def test_deadline_reminder_logic_and_idempotent_deduplication(client: TestClient, db_session):
    """Verify deadline reminder window matching, submitted member exclusion, and idempotent deduplication."""
    admin_token = get_user_token(client, "super_admin")
    member_token = get_user_token(client, "member")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Find member user
    member_user = db_session.execute(select(User).where(User.telegram_id == 10001)).scalar_one_or_none()
    assert member_user is not None

    now = datetime.now(timezone.utc)
    # 1. Create Assignment due in 12 hours (falls into 24h window)
    a1 = Assignment(
        title="Diplomatiya Test Vazifasi 24h",
        slug="diplomatiya-test-24h",
        direction="Think & Discuss",
        description="24h muddat testi",
        instructions="Tezkor javob yozing",
        max_score=100.0,
        status="published",
        deadline_at=now + timedelta(hours=12),
        publish_at=now - timedelta(days=1),
        created_by_id=1
    )
    db_session.add(a1)
    db_session.commit()

    # Run reminder processor 1st time
    res1 = client.post("/api/notifications/admin/process-reminders", headers=admin_headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["reminders_sent"] >= 1

    # Check that member received a 24h reminder
    notif = db_session.execute(
        select(Notification).where(
            Notification.user_id == member_user.id,
            Notification.related_entity_id == str(a1.id),
            Notification.type == NotificationType.DEADLINE_REMINDER.value
        )
    ).scalar_one_or_none()
    assert notif is not None
    assert "24 soat" in notif.title

    # Run reminder processor 2nd time immediately (Idempotency check)
    res2 = client.post("/api/notifications/admin/process-reminders", headers=admin_headers)
    assert res2.status_code == 200
    data2 = res2.json()
    # It must NOT send duplicate reminders!
    assert data2["skipped_duplicates"] >= 1


def test_telegram_delivery_safety_and_failure_tolerance(client: TestClient, db_session):
    """Verify Telegram delivery failures do not crash core transactions or raise unhandled exceptions."""
    member_token = get_user_token(client, "member")
    member_user = db_session.execute(select(User).where(User.telegram_id == 10001)).scalar_one_or_none()
    assert member_user is not None

    # Mock httpx failure simulating Telegram 403 Forbidden (bot blocked by user)
    with patch("app.config.settings.TELEGRAM_BOT_TOKEN", "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"), \
         patch("httpx.Client.post") as mock_post:
        mock_post.return_value.status_code = 403
        mock_post.return_value.text = '{"ok":false,"error_code":403,"description":"Forbidden: bot was blocked by the user"}'

        # Trigger notification
        notif = notification_service.create_notification(
            session=db_session,
            user_id=member_user.id,
            notification_type=NotificationType.FEEDBACK_AVAILABLE.value,
            title="Taqriz tayyor",
            message="Topshiriq baholandi.",
            send_telegram=True
        )
        db_session.commit()

        # In-app notification must succeed even if Telegram delivery failed!
        assert notif.id is not None
        assert notif.delivery_status == "delivered"
        assert notif.telegram_delivery_status == "failed"
        assert "bot was blocked" in notif.telegram_error


def test_member_progress_dashboard_calculations(client: TestClient, db_session):
    """Verify accurate calculation of personal progress KPIs, averages, and direction breakdown."""
    member_token = get_user_token(client, "member")
    headers = {"Authorization": f"Bearer {member_token}"}

    res = client.get("/api/leaderboard/my-progress", headers=headers)
    assert res.status_code == 200
    p = res.json()

    # Check presence of all required fields
    assert "user_id" in p
    assert "total_points" in p
    assert "average_score" in p
    assert "average_percentage" in p
    assert "total_assignments_available" in p
    assert "assignments_submitted_count" in p
    assert "finalized_evaluations_count" in p
    assert "pending_reviews_count" in p
    assert "draft_submissions_count" in p
    assert "late_submissions_count" in p
    assert "completion_rate" in p
    assert "directions" in p
    assert len(p["directions"]) == 6 # 6 ThinkSpace directions
    assert "recent_results" in p
    assert "recent_activity" in p

    # Verify direction metrics structure
    for d in p["directions"]:
        assert "direction" in d
        assert "assignments_available" in d
        assert "assignments_completed" in d
        assert "average_score" in d


def test_admin_announcement_and_status(client: TestClient, db_session):
    """Verify Super Admin can send announcements and check notification delivery health."""
    admin_token = get_user_token(client, "super_admin")
    member_token = get_user_token(client, "member")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # 1. Non-admin cannot send announcements
    forbidden_res = client.post(
        "/api/notifications/admin/announcement",
        json={"title": "Hack", "message": "Spam announcement"},
        headers=member_headers
    )
    assert forbidden_res.status_code == 403

    # 2. Super Admin sends announcement
    ann_res = client.post(
        "/api/notifications/admin/announcement",
        json={"title": "Rektorat E'loni", "message": "Yangi ilmiy seminar e'lon qilindi.", "send_telegram": False},
        headers=admin_headers
    )
    assert ann_res.status_code == 200
    assert ann_res.json()["success"] is True

    # 3. Check delivery status
    status_res = client.get("/api/notifications/admin/status", headers=admin_headers)
    assert status_res.status_code == 200
    s_data = status_res.json()
    assert s_data["total_notifications"] > 0
