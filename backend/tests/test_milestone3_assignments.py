"""
Comprehensive Milestone 3 tests for the Assignment Management System.
Verifies RBAC, draft/published/closed/archived lifecycle, direction validation,
sorting, member visibility restrictions, and audit logging.
"""
from datetime import datetime, timezone, timedelta
import pytest
from starlette.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.assignment import Assignment, AssignmentStatus
from app.models.audit import AuditLog

def test_member_cannot_create_assignment(client: TestClient, member_token: str):
    headers = {"Authorization": f"Bearer {member_token}"}
    payload = {
        "title": "Unauthorized Assignment",
        "direction": "Think & Read",
        "short_description": "Short description for test",
        "instructions": "Full instructions for member",
        "deadline_at": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        "max_score": 100,
    }
    res = client.post("/api/assignments", json=payload, headers=headers)
    assert res.status_code == 403

def test_unauthenticated_request_rejected(client: TestClient):
    res = client.get("/api/assignments")
    assert res.status_code == 401

def test_evaluator_can_create_draft_assignment(client: TestClient, evaluator_token: str, db_session: Session):
    headers = {"Authorization": f"Bearer {evaluator_token}"}
    payload = {
        "title": "Think & Read: Adam Smith Analysis",
        "direction": "Think & Read",
        "short_description": "Analyze key concepts from Wealth of Nations",
        "instructions": "Provide a critical evaluation of division of labor in modern global trade.",
        "difficulty": "intermediate",
        "status": "draft",
        "deadline_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "max_score": 100,
    }
    res = client.post("/api/assignments", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "draft"
    assert data["direction"] == "Think & Read"
    assert data["difficulty"] == "intermediate"
    assert data["short_description"] == payload["short_description"]
    assert data["deadline"] is not None

    # Verify audit log recorded
    audit = db_session.execute(
        select(AuditLog).where(AuditLog.entity_id == str(data["id"]), AuditLog.action == "ASSIGNMENT_CREATED")
    ).scalar_one_or_none()
    assert audit is not None
    assert audit.details["title"] == payload["title"]

def test_member_cannot_see_draft_or_archived_assignments(
    client: TestClient,
    evaluator_token: str,
    moderator_token: str,
    member_token: str
):
    eval_headers = {"Authorization": f"Bearer {evaluator_token}"}
    mod_headers = {"Authorization": f"Bearer {moderator_token}"}
    mem_headers = {"Authorization": f"Bearer {member_token}"}

    # 1. Evaluator creates a Draft assignment
    draft_res = client.post("/api/assignments", json={
        "title": "Secret Draft Task",
        "direction": "Think & Create",
        "short_description": "Brainstorm innovative solutions",
        "instructions": "Full secret instructions",
        "status": "draft",
        "deadline_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
        "max_score": 100
    }, headers=eval_headers)
    assert draft_res.status_code == 201
    draft_id = draft_res.json()["id"]

    # 2. Evaluator creates a Published assignment
    pub_res = client.post("/api/assignments", json={
        "title": "Public Case Analysis",
        "direction": "Think & Analyze",
        "short_description": "Public economic case",
        "instructions": "Detailed public instructions",
        "status": "published",
        "deadline_at": (datetime.now(timezone.utc) + timedelta(days=4)).isoformat(),
        "max_score": 100
    }, headers=eval_headers)
    assert pub_res.status_code == 201
    pub_id = pub_res.json()["id"]

    # 3. Member lists assignments - should see Public, but NOT Draft
    member_list_res = client.get("/api/assignments", headers=mem_headers)
    assert member_list_res.status_code == 200
    member_assignments = member_list_res.json()
    ids_seen = [a["id"] for a in member_assignments]
    assert pub_id in ids_seen
    assert draft_id not in ids_seen

    # 4. Member tries to fetch Draft detail directly - should get 403 Forbidden
    detail_res = client.get(f"/api/assignments/{draft_id}", headers=mem_headers)
    assert detail_res.status_code == 403

    # 5. Moderator archives the public assignment
    archive_res = client.post(f"/api/assignments/{pub_id}/archive", headers=mod_headers)
    assert archive_res.status_code == 200
    assert archive_res.json()["status"] == "archived"

    # 6. Member lists assignments again - archived assignment must be hidden
    member_list_after_archive = client.get("/api/assignments", headers=mem_headers)
    ids_after = [a["id"] for a in member_list_after_archive.json()]
    assert pub_id not in ids_after

    # 7. Member tries to view detail of archived assignment - gets 403
    arch_detail_res = client.get(f"/api/assignments/{pub_id}", headers=mem_headers)
    assert arch_detail_res.status_code == 403

    # 8. Staff can still view archived assignment in admin panel
    staff_arch_res = client.get(f"/api/assignments/{pub_id}", headers=mod_headers)
    assert staff_arch_res.status_code == 200
    assert staff_arch_res.json()["status"] == "archived"

def test_direction_validation_and_normalization(client: TestClient, evaluator_token: str):
    headers = {"Authorization": f"Bearer {evaluator_token}"}

    # Invalid direction should be rejected with 422
    invalid_res = client.post("/api/assignments", json={
        "title": "Invalid Direction Task",
        "direction": "Think & Hack",
        "short_description": "Invalid test",
        "instructions": "Invalid test instructions",
        "deadline_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "max_score": 100
    }, headers=headers)
    assert invalid_res.status_code == 422

    # Valid directions with slug should normalize cleanly
    for slug, expected in [
        ("think_read", "Think & Read"),
        ("think_discuss", "Think & Discuss"),
        ("think_analyze", "Think & Analyze"),
        ("think_lead", "Think & Lead"),
        ("think_create", "Think & Create"),
        ("think_connect", "Think & Connect"),
    ]:
        res = client.post("/api/assignments", json={
            "title": f"Task for {slug}",
            "direction": slug,
            "short_description": f"Short desc for {slug}",
            "instructions": f"Instructions for {slug}",
            "deadline_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
            "max_score": 100
        }, headers=headers)
        assert res.status_code == 201
        assert res.json()["direction"] == expected

def test_assignment_lifecycle_actions_and_audit(
    client: TestClient,
    evaluator_token: str,
    moderator_token: str,
    super_admin_token: str,
    db_session: Session
):
    eval_headers = {"Authorization": f"Bearer {evaluator_token}"}
    mod_headers = {"Authorization": f"Bearer {moderator_token}"}
    admin_headers = {"Authorization": f"Bearer {super_admin_token}"}

    # 1. Create draft
    create_res = client.post("/api/assignments", json={
        "title": "Central Bank Policy Simulation",
        "direction": "Think & Lead",
        "short_description": "Formulate monetary strategy for inflation targets",
        "instructions": "Detail rate adjustments and open market operations.",
        "difficulty": "advanced",
        "status": "draft",
        "deadline_at": (datetime.now(timezone.utc) + timedelta(days=10)).isoformat(),
        "max_score": 100
    }, headers=eval_headers)
    assert create_res.status_code == 201
    assign_id = create_res.json()["id"]

    # 2. Update assignment
    update_res = client.patch(f"/api/assignments/{assign_id}", json={
        "title": "Central Bank Policy Simulation (2026 Edition)",
        "difficulty": "expert"
    }, headers=eval_headers)
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Central Bank Policy Simulation (2026 Edition)"
    assert update_res.json()["difficulty"] == "expert"

    # 3. Publish assignment
    pub_res = client.post(f"/api/assignments/{assign_id}/publish", headers=mod_headers)
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "published"
    assert pub_res.json()["published_at"] is not None

    # 4. Close assignment
    close_res = client.post(f"/api/assignments/{assign_id}/close", headers=mod_headers)
    assert close_res.status_code == 200
    assert close_res.json()["status"] == "closed"

    # 5. Archive assignment
    arch_res = client.post(f"/api/assignments/{assign_id}/archive", headers=admin_headers)
    assert arch_res.status_code == 200
    assert arch_res.json()["status"] == "archived"

    # 6. Revert to draft
    draft_res = client.post(f"/api/assignments/{assign_id}/draft", headers=admin_headers)
    assert draft_res.status_code == 200
    assert draft_res.json()["status"] == "draft"

    # 7. Delete assignment
    del_res = client.delete(f"/api/assignments/{assign_id}", headers=admin_headers)
    assert del_res.status_code == 200

    # Verify audit logs generated for all stages
    audits = db_session.execute(
        select(AuditLog).where(AuditLog.entity_id == str(assign_id))
    ).scalars().all()
    actions = [a.action for a in audits]
    assert "ASSIGNMENT_CREATED" in actions
    assert "ASSIGNMENT_UPDATED" in actions
    assert "ASSIGNMENT_PUBLISHED" in actions
    assert "ASSIGNMENT_CLOSED" in actions
    assert "ASSIGNMENT_ARCHIVED" in actions
    assert "ASSIGNMENT_REVERTED_TO_DRAFT" in actions
    assert "ASSIGNMENT_DELETED" in actions

def test_sorting_and_filtering_rules(client: TestClient, evaluator_token: str, member_token: str):
    eval_headers = {"Authorization": f"Bearer {evaluator_token}"}
    mem_headers = {"Authorization": f"Bearer {member_token}"}

    now = datetime.now(timezone.utc)
    # Create 3 published tasks with different deadlines and directions
    client.post("/api/assignments", json={
        "title": "Task Soon",
        "direction": "Think & Read",
        "short_description": "Due in 2 days",
        "instructions": "Due in 2 days",
        "status": "published",
        "deadline_at": (now + timedelta(days=2)).isoformat(),
        "max_score": 100
    }, headers=eval_headers)

    client.post("/api/assignments", json={
        "title": "Task Later",
        "direction": "Think & Analyze",
        "short_description": "Due in 10 days",
        "instructions": "Due in 10 days",
        "status": "published",
        "deadline_at": (now + timedelta(days=10)).isoformat(),
        "max_score": 100
    }, headers=eval_headers)

    client.post("/api/assignments", json={
        "title": "Task Closed",
        "direction": "Think & Read",
        "short_description": "Already completed",
        "instructions": "Already completed",
        "status": "closed",
        "deadline_at": (now - timedelta(days=1)).isoformat(),
        "max_score": 100
    }, headers=eval_headers)

    # 1. Member lists all: active should precede closed; Task Soon should precede Task Later
    all_res = client.get("/api/assignments", headers=mem_headers)
    assert all_res.status_code == 200
    tasks = all_res.json()
    titles = [t["title"] for t in tasks if t["title"] in ["Task Soon", "Task Later", "Task Closed"]]
    # Active tasks come first, sorted by nearest deadline
    assert titles.index("Task Soon") < titles.index("Task Later")
    assert titles.index("Task Later") < titles.index("Task Closed")

    # 2. Filter by direction
    dir_res = client.get("/api/assignments", params={"direction": "Think & Read"}, headers=mem_headers)
    assert dir_res.status_code == 200
    dir_tasks = dir_res.json()
    assert all(t["direction"] == "Think & Read" for t in dir_tasks)
    assert any(t["title"] == "Task Soon" for t in dir_tasks)
    assert not any(t["title"] == "Task Later" for t in dir_tasks)

    # 3. Filter by status: active only
    active_res = client.get("/api/assignments", params={"status": "active"}, headers=mem_headers)
    assert active_res.status_code == 200
    active_titles = [t["title"] for t in active_res.json()]
    assert "Task Soon" in active_titles
    assert "Task Later" in active_titles
    assert "Task Closed" not in active_titles
