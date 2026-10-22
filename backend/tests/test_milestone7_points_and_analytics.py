"""
Comprehensive Automated Tests for Milestone 7:
Points Engine, Ledger, Competition Ranking, Direction Leaderboards, and Admin Analytics.
"""
from datetime import datetime, timezone, timedelta
import pytest
from starlette.testclient import TestClient

def test_points_engine_calculations_and_bonuses(
    client: TestClient,
    super_admin_token: str,
    evaluator_token: str,
    moderator_token: str,
    member_token: str
):
    admin_headers = {"Authorization": f"Bearer {super_admin_token}"}
    eval_headers = {"Authorization": f"Bearer {evaluator_token}"}
    mod_headers = {"Authorization": f"Bearer {moderator_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # 1. Create an assignment (max_score = 100)
    assign_res = client.post(
        "/api/assignments",
        json={
            "title": "Diplomacy Case Study - Points Test",
            "direction": "Think & Analyze",
            "description": "Analyze diplomatic relations.",
            "instructions": "Write analysis.",
            "status": "open",
            "deadline_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
            "max_score": 100,
            "criteria": [{"title": "Analysis Depth", "max_points": 100}]
        },
        headers=eval_headers
    )
    assert assign_res.status_code in [200, 201]
    assign_id = assign_res.json()["id"]
    crit_id = assign_res.json()["active_rubric"]["criteria"][0]["id"]

    # 2. Member submits formally BEFORE deadline (on-time!)
    sub_res = client.post(
        f"/api/submissions/assignment/{assign_id}",
        data={"text_content": "On-time comprehensive diplomatic analysis."},
        headers=member_headers
    )
    assert sub_res.status_code == 200
    sub_id = sub_res.json()["id"]

    # 3. Evaluator reviews with score 80.0
    client.post(
        "/api/evaluations",
        json={
            "submission_id": sub_id,
            "general_feedback": "Solid work.",
            "is_draft": False,
            "criterion_scores": [{"criterion_id": crit_id, "score": 80.0}]
        },
        headers=eval_headers
    )

    # Verify: UNFINALIZED evaluation awards 0 points to ledger!
    pts_before = client.get("/api/leaderboard/me/points", headers=member_headers).json()
    assign_pts_before = [p for p in pts_before if p["assignment_id"] == assign_id]
    assert len(assign_pts_before) == 0, "No points should be awarded before grade is finalized!"

    # 4. Moderator finalizes evaluation (Publish Grade)
    pub_res = client.post(f"/api/moderation/submissions/{sub_id}/publish-grade", headers=mod_headers)
    assert pub_res.status_code == 200

    # 5. Check Points Ledger:
    # Expected points:
    # - Performance: (80 / 100) * 100 = 80.0
    # - Completion bonus: +10.0
    # - On-time bonus: +5.0
    # Total for this assignment = 95.0
    pts_after = client.get("/api/leaderboard/me/points", headers=member_headers).json()
    assign_pts = [p for p in pts_after if p["assignment_id"] == assign_id]
    assert len(assign_pts) == 3, f"Expected 3 transactions, got {assign_pts}"

    types_awarded = {p["transaction_type"]: p["points"] for p in assign_pts}
    assert types_awarded["assignment_performance"] == 80.0
    assert types_awarded["assignment_completion"] == 10.0
    assert types_awarded["on_time_bonus"] == 5.0
    assert sum(types_awarded.values()) == 95.0

    # 6. Idempotency test:
    # If moderator publishes or finalizes again, NO duplicate points must be awarded!
    pub_res_duplicate = client.post(f"/api/moderation/submissions/{sub_id}/publish-grade", headers=mod_headers)
    assert pub_res_duplicate.status_code == 200

    pts_rerun = client.get("/api/leaderboard/me/points", headers=member_headers).json()
    assign_pts_rerun = [p for p in pts_rerun if p["assignment_id"] == assign_id]
    assert len(assign_pts_rerun) == 3, "Duplicate grade publishing must NOT award duplicate points!"

def test_late_submission_does_not_receive_ontime_bonus(
    client: TestClient,
    evaluator_token: str,
    moderator_token: str,
    member_token: str
):
    eval_headers = {"Authorization": f"Bearer {evaluator_token}"}
    mod_headers = {"Authorization": f"Bearer {moderator_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # Create assignment with past deadline
    assign_res = client.post(
        "/api/assignments",
        json={
            "title": "Late Points Test Assignment",
            "direction": "Think & Read",
            "description": "Read and review.",
            "instructions": "Submit review.",
            "status": "open",
            "deadline_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(), # in the past
            "max_score": 100,
            "criteria": [{"title": "Reading Comprehension", "max_points": 100}]
        },
        headers=eval_headers
    )
    assign_id = assign_res.json()["id"]
    crit_id = assign_res.json()["active_rubric"]["criteria"][0]["id"]

    # Member submits LATE
    sub_res = client.post(
        f"/api/submissions/assignment/{assign_id}",
        data={"text_content": "Late submission review text."},
        headers=member_headers
    )
    assert sub_res.json()["is_late"] is True
    sub_id = sub_res.json()["id"]

    # Evaluator scores 90.0
    client.post(
        "/api/evaluations",
        json={
            "submission_id": sub_id,
            "general_feedback": "Good but late.",
            "is_draft": False,
            "criterion_scores": [{"criterion_id": crit_id, "score": 90.0}]
        },
        headers=eval_headers
    )

    # Publish grade
    client.post(f"/api/moderation/submissions/{sub_id}/publish-grade", headers=mod_headers)

    # Check points:
    # Must receive Performance (90) + Completion (10), but ZERO on_time_bonus!
    pts = client.get("/api/leaderboard/me/points", headers=member_headers).json()
    assign_pts = [p for p in pts if p["assignment_id"] == assign_id]
    types_map = {p["transaction_type"]: p["points"] for p in assign_pts}

    assert types_map.get("assignment_performance") == 90.0
    assert types_map.get("assignment_completion") == 10.0
    assert "on_time_bonus" not in types_map, "Late submissions must not receive an on-time bonus!"

def test_score_revision_records_delta_correction(
    client: TestClient,
    evaluator_token: str,
    moderator_token: str,
    member_token: str
):
    eval_headers = {"Authorization": f"Bearer {evaluator_token}"}
    mod_headers = {"Authorization": f"Bearer {moderator_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # Create assignment and submit
    assign_res = client.post(
        "/api/assignments",
        json={
            "title": "Revision Correction Test",
            "direction": "Think & Create",
            "description": "Creative pitch.",
            "instructions": "Submit pitch.",
            "status": "open",
            "deadline_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
            "max_score": 100,
            "criteria": [{"title": "Innovation", "max_points": 100}]
        },
        headers=eval_headers
    )
    assign_id = assign_res.json()["id"]
    crit_id = assign_res.json()["active_rubric"]["criteria"][0]["id"]

    sub_res = client.post(
        f"/api/submissions/assignment/{assign_id}",
        data={"text_content": "Creative idea pitch."},
        headers=member_headers
    )
    sub_id = sub_res.json()["id"]

    # Initial score: 70
    client.post(
        "/api/evaluations",
        json={
            "submission_id": sub_id,
            "general_feedback": "Average pitch.",
            "is_draft": False,
            "criterion_scores": [{"criterion_id": crit_id, "score": 70.0}]
        },
        headers=eval_headers
    )
    pub_res = client.post(f"/api/moderation/submissions/{sub_id}/publish-grade", headers=mod_headers)
    grade_id = pub_res.json()["id"]

    # Moderator revises grade from 70 to 85 (+15 points delta)
    rev_res = client.post(
        f"/api/moderation/published-grades/{grade_id}/revise",
        json={"new_score": 85.0, "reason": "Re-evaluated secondary sources, awarded higher score."},
        headers=mod_headers
    )
    assert rev_res.status_code == 200

    # Verify score correction transaction exists in points ledger with delta = +15.0
    pts = client.get("/api/leaderboard/me/points", headers=member_headers).json()
    corr_tx = next((p for p in pts if p["assignment_id"] == assign_id and p["transaction_type"] == "score_correction"), None)
    assert corr_tx is not None, "Score correction transaction must exist!"
    assert corr_tx["points"] == 15.0

def test_manual_point_adjustment_permissions_and_audit(
    client: TestClient,
    super_admin_token: str,
    evaluator_token: str,
    member_token: str
):
    admin_headers = {"Authorization": f"Bearer {super_admin_token}"}
    eval_headers = {"Authorization": f"Bearer {evaluator_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # 1. Member cannot adjust points
    bad_res = client.post(
        "/api/admin/points/adjust",
        json={"user_id": 3, "points": 10, "reason": "Self award"},
        headers=member_headers
    )
    assert bad_res.status_code == 403

    # 2. Evaluator cannot adjust points (Super Admin only)
    eval_bad_res = client.post(
        "/api/admin/points/adjust",
        json={"user_id": 3, "points": 10, "reason": "Evaluator award"},
        headers=eval_headers
    )
    assert eval_bad_res.status_code == 403

    # 3. Super Admin adjustment with short reason (<5 chars) rejected
    short_reason_res = client.post(
        "/api/admin/points/adjust",
        json={"user_id": 3, "points": 10, "reason": "Good"},
        headers=admin_headers
    )
    assert short_reason_res.status_code in [400, 422]

    # 4. Super Admin adjustment with valid reason succeeds
    adj_res = client.post(
        "/api/admin/points/adjust",
        json={
            "user_id": 3,
            "points": 12.5,
            "reason": "Outstanding active participation in ThinkSpace Symposium"
        },
        headers=admin_headers
    )
    assert adj_res.status_code == 200
    assert adj_res.json()["points"] == 12.5
    assert adj_res.json()["transaction_type"] == "manual_adjustment"

def test_competition_ranking_and_direction_leaderboard(
    client: TestClient,
    member_token: str
):
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # 1. Fetch overall leaderboard
    lb_res = client.get("/api/leaderboard", headers=member_headers)
    assert lb_res.status_code == 200
    entries = lb_res.json()
    assert len(entries) > 0

    # Verify descending points sorting
    scores = [e["total_points"] for e in entries]
    assert scores == sorted(scores, reverse=True), "Leaderboard must be sorted descending by total points!"

    # Verify competition ranking (ranks start at 1 and increment properly)
    assert entries[0]["rank"] == 1
    for i in range(1, len(entries)):
        curr = entries[i]
        prev = entries[i - 1]
        if curr["total_points"] == prev["total_points"] and curr["average_percentage"] == prev["average_percentage"]:
            assert curr["rank"] == prev["rank"], "Tied scores must share the same rank!"
        else:
            assert curr["rank"] == i + 1, "Next non-tied entry must follow standard competition ranking!"

    # 2. Direction filter
    dir_res = client.get("/api/leaderboard?direction=Think & Analyze", headers=member_headers)
    assert dir_res.status_code == 200
    dir_entries = dir_res.json()
    assert len(dir_entries) > 0

    # 3. Personal ranking card
    my_rank_res = client.get("/api/leaderboard/me/rank", headers=member_headers)
    assert my_rank_res.status_code == 200
    rank_data = my_rank_res.json()
    assert "total_points" in rank_data
    assert "direction_ranks" in rank_data
    assert "Think & Analyze" in rank_data["direction_ranks"]

def test_admin_analytics_endpoints_and_member_overview(
    client: TestClient,
    super_admin_token: str,
    member_token: str
):
    admin_headers = {"Authorization": f"Bearer {super_admin_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # 1. Member access forbidden
    for path in ["/api/admin/analytics/overview", "/api/admin/analytics/directions", "/api/admin/analytics/members"]:
        res = client.get(path, headers=member_headers)
        assert res.status_code == 403, f"Member should be forbidden from {path}"

    # 2. Admin analytics overview
    ov_res = client.get("/api/admin/analytics/overview?date_range=all_time", headers=admin_headers)
    assert ov_res.status_code == 200
    data = ov_res.json()
    assert data["total_members"] >= 1
    assert "submission_rate" in data
    assert "on_time_rate" in data
    assert "average_finalized_score" in data
    assert "completion_rate" in data

    # 3. Direction analytics
    dir_res = client.get("/api/admin/analytics/directions", headers=admin_headers)
    assert dir_res.status_code == 200
    dirs = dir_res.json()
    assert len(dirs) == 6, "Must cover all 6 ThinkSpace directions"
    dir_names = {d["direction"] for d in dirs}
    assert "Think & Analyze" in dir_names
    assert "Think & Read" in dir_names

    # 4. Member performance table
    mem_res = client.get("/api/admin/analytics/members?sort_by=points&order=desc", headers=admin_headers)
    assert mem_res.status_code == 200
    table = mem_res.json()
    assert len(table) >= 1
    first_member_id = table[0]["user_id"]

    # 5. Member detail view
    det_res = client.get(f"/api/admin/analytics/members/{first_member_id}", headers=admin_headers)
    assert det_res.status_code == 200
    detail = det_res.json()
    assert detail["user_id"] == first_member_id
    assert "points_history" in detail
    assert "direction_breakdown" in detail
    assert "submissions" in detail
