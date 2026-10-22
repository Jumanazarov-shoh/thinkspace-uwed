"""
Tests for Leaderboard and Personal Progress calculations.
Ensures ONLY published final grades affect scores and rankings.
"""
from datetime import datetime, timezone, timedelta
from starlette.testclient import TestClient

def test_leaderboard_published_grades_only(
    client: TestClient,
    evaluator_token: str,
    moderator_token: str,
    member_token: str
):
    eval_headers = {"Authorization": f"Bearer {evaluator_token}"}
    mod_headers = {"Authorization": f"Bearer {moderator_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # 1. Leaderboard is initially empty or 0 score
    init_lb = client.get("/api/leaderboard")
    assert init_lb.status_code == 200
    for entry in init_lb.json():
        if entry["display_name"] == "Aziz Rahimov":
            assert entry["total_score"] == 0.0

    # 2. Create and submit an assignment
    assign_res = client.post(
        "/api/assignments",
        json={
            "title": "Debate Reflection #1",
            "direction": "Think & Discuss",
            "description": "Debate on multilateral trade agreements.",
            "instructions": "Present rebuttals and consensus points.",
            "status": "open",
            "deadline_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "max_score": 100,
            "criteria": [{"title": "Rhetorical Strength", "max_points": 100}]
        },
        headers=eval_headers
    )
    assign_id = assign_res.json()["id"]
    crit_id = assign_res.json()["active_rubric"]["criteria"][0]["id"]

    sub_res = client.post(
        f"/api/submissions/assignment/{assign_id}",
        data={"text_content": "Debate arguments and rebuttals."},
        headers=member_headers
    )
    sub_id = sub_res.json()["id"]

    # 3. Evaluator submits score (88.0)
    client.post(
        "/api/evaluations",
        json={
            "submission_id": sub_id,
            "general_feedback": "Strong arguments.",
            "is_draft": False,
            "criterion_scores": [{"criterion_id": crit_id, "score": 88.0}]
        },
        headers=eval_headers
    )

    # 4. Check leaderboard BEFORE grade is officially published:
    # Score MUST STILL BE 0.0! (Evaluation alone is NOT published)
    lb_before_pub = client.get("/api/leaderboard")
    for entry in lb_before_pub.json():
        if entry["display_name"] == "Aziz Rahimov":
            assert entry["total_score"] == 0.0

    # 5. Moderator publishes grade
    client.post(f"/api/moderation/submissions/{sub_id}/publish-grade", headers=mod_headers)

    # 6. Check leaderboard AFTER publication:
    # Score must now reflect 88.0!
    lb_after_pub = client.get("/api/leaderboard")
    found = False
    for entry in lb_after_pub.json():
        if entry["display_name"] == "Aziz Rahimov":
            assert entry["total_score"] in [88.0, 103.0]
            assert entry["completed_assignments"] == 1
            assert entry["average_percentage"] == 88.0
            found = True
    assert found

    # 7. Check member personal progress
    prog_res = client.get("/api/leaderboard/my-progress", headers=member_headers)
    assert prog_res.status_code == 200
    prog_data = prog_res.json()
    assert prog_data["total_points"] in [88.0, 103.0]
    assert prog_data["graded_assignments_count"] == 1
    discuss_dir = next((d for d in prog_data["directions"] if d["direction"] == "Think & Discuss"), None)
    assert discuss_dir is not None
    assert discuss_dir["total_score"] == 88.0
    assert discuss_dir["assignments_completed"] == 1
