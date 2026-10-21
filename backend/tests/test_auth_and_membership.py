"""
Tests for Telegram verification, user registration, membership approval, and RBAC.
"""
from starlette.testclient import TestClient
from app.models.user import User, RoleEnum, UserStatus

def test_health_check(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"

def test_unauthorized_access(client: TestClient):
    response = client.get("/api/auth/me")
    assert response.status_code == 401

def test_dev_login(client: TestClient):
    response = client.post("/api/auth/dev-login?role=super_admin")
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["display_name"] == "Admin ThinkSpace"
    roles = [r["role_name"] for r in data["user"]["roles"]]
    assert RoleEnum.SUPER_ADMIN.value in roles

def test_membership_application_and_approval(
    client: TestClient,
    member_token: str,
    moderator_token: str
):
    headers = {"Authorization": f"Bearer {member_token}"}
    
    req_payload = {
        "statement": "I am passionate about international economics and critical discussions.",
        "chosen_directions": ["Think & Read", "Think & Analyze"],
        "student_id": "UWED-2026-042",
        "faculty": "International Economics and Management"
    }
    res = client.post("/api/members/request", json=req_payload, headers=headers)
    assert res.status_code == 200
    req_data = res.json()
    assert req_data["status"] == "pending"
    assert req_data["statement"] == req_payload["statement"]
    request_id = req_data["id"]

    list_res = client.get("/api/members/requests", headers=headers)
    assert list_res.status_code == 403

    mod_headers = {"Authorization": f"Bearer {moderator_token}"}
    mod_list_res = client.get("/api/members/requests", headers=mod_headers)
    assert mod_list_res.status_code == 200
    items = mod_list_res.json()
    assert len(items) >= 1

    review_res = client.post(
        f"/api/members/requests/{request_id}/review",
        json={"action": "approve", "review_comment": "Welcome to ThinkSpace!"},
        headers=mod_headers
    )
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "approved"

def test_role_assignment_super_admin_only(
    client: TestClient,
    member_token: str,
    super_admin_token: str,
    member_user: User
):
    member_headers = {"Authorization": f"Bearer {member_token}"}
    admin_headers = {"Authorization": f"Bearer {super_admin_token}"}

    forbidden_res = client.post(
        f"/api/members/{member_user.id}/roles",
        json={"role_name": "evaluator"},
        headers=member_headers
    )
    assert forbidden_res.status_code == 403

    ok_res = client.post(
        f"/api/members/{member_user.id}/roles",
        json={"role_name": "evaluator"},
        headers=admin_headers
    )
    assert ok_res.status_code == 200
    roles = [r["role_name"] for r in ok_res.json()["roles"]]
    assert "evaluator" in roles
