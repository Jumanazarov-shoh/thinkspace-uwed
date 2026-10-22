"""
Unit & Integration tests for ThinkSpace | UWED Milestone 4: Member Submission System.
Verifies drafts, submissions, deadlines, file uploads, ownership isolation,
validation rules, and administrative overviews.
"""
from datetime import datetime, timezone, timedelta
import io
import pytest
from starlette.testclient import TestClient
from app.models.user import User, RoleEnum, UserStatus, UserRole
from app.models.assignment import Assignment, AssignmentStatus
from app.models.submission import Submission, SubmissionStatus
from app.services.auth_service import create_access_token

def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

def _create_test_assignment(db_session, admin_user: User, deadline=None, status="published") -> Assignment:
    if deadline is None:
        deadline = datetime.now(timezone.utc) + timedelta(days=7)

    assign = Assignment(
        title="Test Policy Briefing",
        slug=f"test-policy-briefing-{datetime.now().timestamp()}",
        direction="Think & Analyze",
        description="Write a policy brief regarding digital diplomacy.",
        instructions="Complete the 3 questions and attach supporting research.",
        deadline_at=deadline,
        max_score=100,
        status=status,
        created_by_id=admin_user.id
    )
    db_session.add(assign)
    db_session.commit()
    db_session.refresh(assign)
    return assign

def test_member_can_save_draft_and_persist(client: TestClient, db_session, member_user: User, member_token: str, super_admin_user: User):
    assignment = _create_test_assignment(db_session, super_admin_user)

    data = {
        "text_content": "Draft response: Preliminary notes on international law.",
        "link_url": "https://thinkspace.uwed.uz/research/prelim"
    }
    res = client.post(
        f"/api/submissions/assignment/{assignment.id}/draft",
        data=data,
        headers=_auth_header(member_token)
    )
    assert res.status_code == 200, res.text
    sub = res.json()
    assert sub["status"] == "draft"
    assert sub["submitted_at"] is None
    assert sub["is_late"] is False
    assert sub["latest_version"]["text_content"] == data["text_content"]
    assert sub["latest_version"]["link_url"] == data["link_url"]

    # Verify query
    check = client.get(
        f"/api/submissions/assignment/{assignment.id}/my-submission",
        headers=_auth_header(member_token)
    )
    assert check.status_code == 200
    assert check.json()["status"] == "draft"

def test_member_can_submit_assignment_before_deadline(client: TestClient, db_session, member_user: User, member_token: str, super_admin_user: User):
    assignment = _create_test_assignment(
        db_session, super_admin_user,
        deadline=datetime.now(timezone.utc) + timedelta(days=3)
    )

    data = {
        "text_content": "Final analysis: The economic impact of digital corridors.",
        "link_url": "https://un.org/reports/digital-corridor"
    }
    res = client.post(
        f"/api/submissions/assignment/{assignment.id}/submit",
        data=data,
        headers=_auth_header(member_token)
    )
    assert res.status_code == 200, res.text
    sub = res.json()
    assert sub["status"] == "submitted"
    assert sub["is_late"] is False
    assert sub["submitted_at"] is not None
    assert sub["latest_version"]["version_number"] == 1

def test_late_submission_marked_late_when_past_deadline(client: TestClient, db_session, member_user: User, member_token: str, super_admin_user: User):
    # Deadline 2 hours in the past
    past_deadline = datetime.now(timezone.utc) - timedelta(hours=2)
    assignment = _create_test_assignment(db_session, super_admin_user, deadline=past_deadline)

    data = {
        "text_content": "Late response submitted after deadline."
    }
    res = client.post(
        f"/api/submissions/assignment/{assignment.id}/submit",
        data=data,
        headers=_auth_header(member_token)
    )
    assert res.status_code == 200, res.text
    sub = res.json()
    assert sub["status"] == "late"
    assert sub["is_late"] is True
    assert sub["submitted_at"] is not None

def test_empty_submission_rejected(client: TestClient, db_session, member_user: User, member_token: str, super_admin_user: User):
    assignment = _create_test_assignment(db_session, super_admin_user)

    data = {
        "text_content": "   ",
        "link_url": ""
    }
    res = client.post(
        f"/api/submissions/assignment/{assignment.id}/submit",
        data=data,
        headers=_auth_header(member_token)
    )
    assert res.status_code == 400
    assert "matn, havola yoki fayl" in res.json()["detail"].lower()

def test_ownership_isolation_between_members(client: TestClient, db_session, member_user: User, member_token: str, super_admin_user: User, super_admin_token: str):
    assignment = _create_test_assignment(db_session, super_admin_user)

    # Member A submits
    res_a = client.post(
        f"/api/submissions/assignment/{assignment.id}/submit",
        data={"text_content": "Member A Private Work"},
        headers=_auth_header(member_token)
    )
    sub_id = res_a.json()["id"]

    # Member B creates account
    user_b = User(
        telegram_id=987654321,
        username="farrukh_ts",
        first_name="Farrukh",
        last_name="Toshmatov",
        display_name="Farrukh Toshmatov",
        status=UserStatus.APPROVED.value,
        preferred_language="uz"
    )
    db_session.add(user_b)
    db_session.flush()
    db_session.add(UserRole(user_id=user_b.id, role_name=RoleEnum.MEMBER.value))
    db_session.commit()
    db_session.refresh(user_b)
    token_b = create_access_token({"sub": str(user_b.id), "tg_id": user_b.telegram_id})

    # Member B attempts to read Member A's submission directly
    res_b = client.get(
        f"/api/submissions/{sub_id}",
        headers=_auth_header(token_b)
    )
    assert res_b.status_code == 403
    assert "ruxsat yo'q" in res_b.json()["detail"].lower()

    # Admin CAN read Member A's submission
    res_admin = client.get(
        f"/api/submissions/{sub_id}",
        headers=_auth_header(super_admin_token)
    )
    assert res_admin.status_code == 200
    assert res_admin.json()["latest_version"]["text_content"] == "Member A Private Work"

def test_url_validation_and_rejection(client: TestClient, db_session, member_user: User, member_token: str, super_admin_user: User):
    assignment = _create_test_assignment(db_session, super_admin_user)

    # Invalid URL without scheme
    res_bad = client.post(
        f"/api/submissions/assignment/{assignment.id}/submit",
        data={"link_url": "javascript:alert(1)"},
        headers=_auth_header(member_token)
    )
    assert res_bad.status_code == 400

    # Valid HTTPS URL
    res_good = client.post(
        f"/api/submissions/assignment/{assignment.id}/submit",
        data={"link_url": "https://scholar.google.com/citations?user=123"},
        headers=_auth_header(member_token)
    )
    assert res_good.status_code == 200

def test_file_upload_support_and_rejection(client: TestClient, db_session, member_user: User, member_token: str, super_admin_user: User):
    assignment = _create_test_assignment(db_session, super_admin_user)

    # 1. Unsupported executable file
    exe_file = ("script.exe", io.BytesIO(b"MZ executable header"), "application/x-msdownload")
    res_exe = client.post(
        f"/api/submissions/assignment/{assignment.id}/submit",
        data={"text_content": "Uploading malicious exe"},
        files=[("files", exe_file)],
        headers=_auth_header(member_token)
    )
    assert res_exe.status_code == 400
    assert "ruxsat etilmagan" in res_exe.json()["detail"].lower()

    # 2. Supported academic PDF file
    pdf_file = ("diplomacy_paper.pdf", io.BytesIO(b"%PDF-1.4 sample content for testing"), "application/pdf")
    res_pdf = client.post(
        f"/api/submissions/assignment/{assignment.id}/submit",
        data={"text_content": "Valid submission with PDF attachment"},
        files=[("files", pdf_file)],
        headers=_auth_header(member_token)
    )
    assert res_pdf.status_code == 200
    sub = res_pdf.json()
    assert len(sub["latest_version"]["files"]) == 1
    assert sub["latest_version"]["files"][0]["original_filename"] == "diplomacy_paper.pdf"

def test_oversized_file_rejected(client: TestClient, db_session, member_user: User, member_token: str, super_admin_user: User):
    assignment = _create_test_assignment(db_session, super_admin_user)

    # 11 MB fake payload (> 10MB limit)
    oversized_bytes = b"0" * (11 * 1024 * 1024)
    big_file = ("large_video.pdf", io.BytesIO(oversized_bytes), "application/pdf")

    res = client.post(
        f"/api/submissions/assignment/{assignment.id}/submit",
        data={"text_content": "Testing file size limit"},
        files=[("files", big_file)],
        headers=_auth_header(member_token)
    )
    assert res.status_code == 400
    assert "oshib ketdi" in res.json()["detail"].lower()

def test_delete_attachment_flow(client: TestClient, db_session, member_user: User, member_token: str, super_admin_user: User):
    assignment = _create_test_assignment(db_session, super_admin_user)

    pdf_file = ("notes.pdf", io.BytesIO(b"%PDF sample"), "application/pdf")
    res = client.post(
        f"/api/submissions/assignment/{assignment.id}/draft",
        data={"text_content": "Draft with attachment to delete"},
        files=[("files", pdf_file)],
        headers=_auth_header(member_token)
    )
    assert res.status_code == 200
    sub_id = res.json()["id"]
    file_id = res.json()["latest_version"]["files"][0]["id"]

    # Delete attachment
    del_res = client.delete(
        f"/api/submissions/{sub_id}/attachments/{file_id}",
        headers=_auth_header(member_token)
    )
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # Verify attachment is gone
    check = client.get(
        f"/api/submissions/{sub_id}",
        headers=_auth_header(member_token)
    )
    assert len(check.json()["latest_version"]["files"]) == 0

def test_locked_submission_cannot_be_modified(client: TestClient, db_session, member_user: User, member_token: str, super_admin_user: User):
    assignment = _create_test_assignment(db_session, super_admin_user)

    # Submit
    res = client.post(
        f"/api/submissions/assignment/{assignment.id}/submit",
        data={"text_content": "Locked Work"},
        headers=_auth_header(member_token)
    )
    sub_id = res.json()["id"]

    # Admin manually locks submission
    db_sub = db_session.query(Submission).filter(Submission.id == sub_id).first()
    db_sub.status = SubmissionStatus.LOCKED.value
    db_session.commit()

    # Member attempts to edit or resubmit
    res_edit = client.post(
        f"/api/submissions/assignment/{assignment.id}/submit",
        data={"text_content": "Attempting edit on locked submission"},
        headers=_auth_header(member_token)
    )
    assert res_edit.status_code == 400
    assert "qulflangan" in res_edit.json()["detail"].lower()

def test_my_submissions_and_admin_overview_lists(client: TestClient, db_session, member_user: User, member_token: str, super_admin_user: User, super_admin_token: str):
    assignment = _create_test_assignment(db_session, super_admin_user)

    # Submit
    client.post(
        f"/api/submissions/assignment/{assignment.id}/submit",
        data={"text_content": "Comprehensive analysis for Think & Analyze", "link_url": "https://thinkspace.uz"},
        headers=_auth_header(member_token)
    )

    # 1. Member calls /api/submissions/my-submissions
    my_res = client.get(
        "/api/submissions/my-submissions",
        headers=_auth_header(member_token)
    )
    assert my_res.status_code == 200
    my_subs = my_res.json()
    assert len(my_subs) >= 1
    target = next((s for s in my_subs if s["assignment_id"] == assignment.id), None)
    assert target is not None
    assert target["status"] in ["submitted", "late"]
    assert target["has_text"] is True
    assert target["has_link"] is True

    # 2. Admin calls /api/submissions/admin/overview
    admin_res = client.get(
        "/api/submissions/admin/overview",
        headers=_auth_header(super_admin_token)
    )
    assert admin_res.status_code == 200
    admin_items = admin_res.json()
    assert len(admin_items) >= 1
    admin_target = next((s for s in admin_items if s["assignment_id"] == assignment.id), None)
    assert admin_target is not None
    assert admin_target["user_name"] == (member_user.display_name or f"{member_user.first_name} {member_user.last_name or ''}".strip())
