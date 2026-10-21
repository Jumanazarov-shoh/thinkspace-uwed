"""
Milestone 2 Automated Test Suite:
- Telegram HMAC-SHA256 signature verification (valid, tampered, expired)
- Duplicate Telegram ID upsert handling
- Unauthenticated API requests (401)
- Member & privileged role access boundaries (403)
- Prevention of self-role modification (400)
- Super Admin environment bootstrapping
- Membership application & approval with audit logging
"""
from datetime import datetime, timezone
import hashlib
import hmac
import json
import urllib.parse
from starlette.testclient import TestClient
from sqlalchemy import select
from app.config import settings
from app.models.user import User, RoleEnum, UserStatus
from app.models.audit import AuditLog

def generate_test_init_data(user_dict: dict, bot_token: str, auth_date: int = None) -> str:
    """Helper to construct an authentic Telegram Mini App initData string with valid HMAC-SHA256 hash."""
    if auth_date is None:
        auth_date = int(datetime.now(timezone.utc).timestamp())

    user_json = json.dumps(user_dict, separators=(',', ':'))
    params = {
        "auth_date": str(auth_date),
        "query_id": "AAHdF6IQAAAAAN0XohDhrOrc",
        "user": user_json
    }

    # Sort keys alphabetically and join with \n
    sorted_pairs = [f"{k}={params[k]}" for k in sorted(params.keys())]
    data_check_string = "\n".join(sorted_pairs)

    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    data_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    params["hash"] = data_hash

    return urllib.parse.urlencode(params)

def test_health_check(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"

def test_unauthenticated_api_requests(client: TestClient):
    # Protected routes must return 401 without Bearer token
    assert client.get("/api/auth/me").status_code == 401
    assert client.patch("/api/members/me", json={"display_name": "New Name"}).status_code == 401
    assert client.get("/api/members/requests").status_code == 401
    assert client.get("/api/members").status_code == 401

def test_dev_login(client: TestClient):
    response = client.post("/api/auth/dev-login?role=super_admin")
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["display_name"] == "Admin ThinkSpace"
    roles = [r["role_name"] for r in data["user"]["roles"]]
    assert RoleEnum.SUPER_ADMIN.value in roles

def test_valid_telegram_authentication(client: TestClient, monkeypatch):
    test_token = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", test_token)

    tg_user = {
        "id": 12345678,
        "first_name": "Aziz",
        "last_name": "Alimov",
        "username": "azizalimov",
        "language_code": "uz"
    }
    init_data = generate_test_init_data(tg_user, test_token)

    response = client.post("/api/auth/telegram", json={"init_data": init_data})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["telegram_id"] == 12345678
    assert data["user"]["display_name"] == "Aziz Alimov"
    assert data["user"]["status"] == UserStatus.PENDING.value

def test_invalid_or_tampered_telegram_auth_data(client: TestClient, monkeypatch):
    test_token = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", test_token)

    tg_user = {"id": 12345678, "first_name": "Hacker", "username": "badactor"}
    init_data = generate_test_init_data(tg_user, test_token)

    # 1. Tampered hash
    tampered_hash_data = init_data[:-4] + "dead"
    res1 = client.post("/api/auth/telegram", json={"init_data": tampered_hash_data})
    assert res1.status_code == 401

    # 2. Tampered user payload after hashing
    tampered_payload_data = init_data.replace("Hacker", "SuperAdmin")
    res2 = client.post("/api/auth/telegram", json={"init_data": tampered_payload_data})
    assert res2.status_code == 401

    # 3. Missing hash
    res3 = client.post("/api/auth/telegram", json={"init_data": "user=%7B%22id%22%3A1%7D&auth_date=12345"})
    assert res3.status_code == 401

def test_expired_telegram_auth_data(client: TestClient, monkeypatch):
    test_token = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", test_token)

    # Auth date 2 days ago (> 86400 seconds)
    expired_timestamp = int(datetime.now(timezone.utc).timestamp()) - 172800
    tg_user = {"id": 12345678, "first_name": "Old", "username": "olduser"}
    expired_data = generate_test_init_data(tg_user, test_token, auth_date=expired_timestamp)

    response = client.post("/api/auth/telegram", json={"init_data": expired_data})
    assert response.status_code == 401

def test_duplicate_telegram_id_handling(client: TestClient, monkeypatch):
    test_token = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", test_token)

    tg_user = {"id": 55544433, "first_name": "Jasur", "username": "jasur1"}
    data1 = generate_test_init_data(tg_user, test_token)
    res1 = client.post("/api/auth/telegram", json={"init_data": data1})
    assert res1.status_code == 200
    user_id_1 = res1.json()["user"]["id"]

    # Authenticate again with same Telegram ID but updated name
    tg_user_updated = {"id": 55544433, "first_name": "Jasur", "last_name": "Bek", "username": "jasurbek"}
    data2 = generate_test_init_data(tg_user_updated, test_token)
    res2 = client.post("/api/auth/telegram", json={"init_data": data2})
    assert res2.status_code == 200
    user_id_2 = res2.json()["user"]["id"]

    # Same user record updated cleanly without duplicate key error
    assert user_id_1 == user_id_2
    assert res2.json()["user"]["display_name"] == "Jasur Bek"

def test_member_access_restrictions(client: TestClient, member_token: str):
    headers = {"Authorization": f"Bearer {member_token}"}
    
    # Regular members cannot list membership requests
    res1 = client.get("/api/members/requests", headers=headers)
    assert res1.status_code == 403

    # Regular members cannot list all users
    res2 = client.get("/api/members", headers=headers)
    assert res2.status_code == 403

    # Regular members cannot assign roles
    res3 = client.post("/api/members/1/roles", json={"role_name": "evaluator"}, headers=headers)
    assert res3.status_code == 403

def test_privileged_role_access_restrictions(client: TestClient, evaluator_token: str, moderator_token: str):
    eval_headers = {"Authorization": f"Bearer {evaluator_token}"}
    mod_headers = {"Authorization": f"Bearer {moderator_token}"}

    # Evaluators and Moderators cannot assign roles (only Super Admin can)
    assert client.post("/api/members/1/roles", json={"role_name": "evaluator"}, headers=eval_headers).status_code == 403
    assert client.post("/api/members/1/roles", json={"role_name": "evaluator"}, headers=mod_headers).status_code == 403

def test_cannot_modify_own_role(client: TestClient, super_admin_token: str, super_admin_user: User):
    admin_headers = {"Authorization": f"Bearer {super_admin_token}"}

    # Attempting to assign a role to oneself must be rejected with 400
    self_assign_res = client.post(
        f"/api/members/{super_admin_user.id}/roles",
        json={"role_name": "senior_reviewer"},
        headers=admin_headers
    )
    assert self_assign_res.status_code == 400
    assert "Cannot modify your own role" in self_assign_res.json()["detail"]

    # Attempting to revoke a role from oneself must be rejected with 400
    self_revoke_res = client.delete(
        f"/api/members/{super_admin_user.id}/roles/super_admin",
        headers=admin_headers
    )
    assert self_revoke_res.status_code == 400
    assert "Cannot modify your own role" in self_revoke_res.json()["detail"]

def test_super_admin_bootstrap_procedure(client: TestClient, monkeypatch):
    test_token = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
    bootstrap_tg_id = 777000111
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", test_token)
    monkeypatch.setattr(settings, "SUPER_ADMIN_TELEGRAM_ID", bootstrap_tg_id)

    # 1. Normal user signs in: status is PENDING, no super_admin role
    normal_tg = {"id": 111222, "first_name": "Normal", "username": "normal"}
    res_normal = client.post("/api/auth/telegram", json={"init_data": generate_test_init_data(normal_tg, test_token)})
    assert res_normal.status_code == 200
    assert res_normal.json()["user"]["status"] == UserStatus.PENDING.value
    normal_roles = [r["role_name"] for r in res_normal.json()["user"]["roles"]]
    assert RoleEnum.SUPER_ADMIN.value not in normal_roles

    # 2. Designated Super Admin signs in: status is automatically APPROVED with SUPER_ADMIN role
    admin_tg = {"id": bootstrap_tg_id, "first_name": "Master", "username": "leadadmin"}
    res_admin = client.post("/api/auth/telegram", json={"init_data": generate_test_init_data(admin_tg, test_token)})
    assert res_admin.status_code == 200
    assert res_admin.json()["user"]["status"] == UserStatus.APPROVED.value
    admin_roles = [r["role_name"] for r in res_admin.json()["user"]["roles"]]
    assert RoleEnum.SUPER_ADMIN.value in admin_roles

def test_membership_application_and_approval(
    client: TestClient,
    member_token: str,
    moderator_token: str,
    db_session
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

    # Moderator reviews application
    mod_headers = {"Authorization": f"Bearer {moderator_token}"}
    review_res = client.post(
        f"/api/members/requests/{request_id}/review",
        json={"action": "approve", "review_comment": "Welcome to ThinkSpace!"},
        headers=mod_headers
    )
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "approved"

    # Verify audit log was created
    audit = db_session.execute(select(AuditLog).where(AuditLog.entity_id == str(request_id))).scalar_one_or_none()
    assert audit is not None
    assert audit.action == "membership_request_approve"
