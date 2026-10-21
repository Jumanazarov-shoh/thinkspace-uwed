"""
Tests for assignment creation, rubric consistency, submission versioning, and deadlines.
"""
from datetime import datetime, timezone, timedelta
from starlette.testclient import TestClient

def test_rubric_sum_validation(client: TestClient, evaluator_token: str):
    headers = {"Authorization": f"Bearer {evaluator_token}"}
    
    invalid_assignment = {
        "title": "Invalid Rubric Task",
        "direction": "Think & Analyze",
        "description": "Analyzing international trade flows.",
        "instructions": "Follow the structured guidelines.",
        "status": "draft",
        "deadline_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "max_score": 100,
        "criteria": [
            {"title": "Depth of analysis", "max_points": 30},
            {"title": "Clarity", "max_points": 20}
        ]
    }
    res = client.post("/api/assignments", json=invalid_assignment, headers=headers)
    assert res.status_code == 422

def test_create_and_submit_assignment_workflow(
    client: TestClient,
    evaluator_token: str,
    member_token: str
):
    eval_headers = {"Authorization": f"Bearer {evaluator_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}

    valid_assignment = {
        "title": "ThinkSpace Case Study #1",
        "direction": "Think & Analyze",
        "description": "Detailed analysis of regional economic integration in Central Asia.",
        "instructions": "Submit a 2-page reflection or analytical overview with credible citations.",
        "status": "open",
        "deadline_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "max_score": 100,
        "min_evaluators": 1,
        "requires_moderation": False,
        "criteria": [
            {"title": "Critical & Analytical Thinking", "max_points": 40, "order_index": 1},
            {"title": "Evidence & Academic Rigor", "max_points": 35, "order_index": 2},
            {"title": "Clarity & Structure", "max_points": 25, "order_index": 3}
        ]
    }
    create_res = client.post("/api/assignments", json=valid_assignment, headers=eval_headers)
    assert create_res.status_code == 201
    assign_data = create_res.json()
    assignment_id = assign_data["id"]
    assert assign_data["status"] == "open"
    assert len(assign_data["active_rubric"]["criteria"]) == 3

    view_res = client.get(f"/api/assignments/{assignment_id}", headers=member_headers)
    assert view_res.status_code == 200
    assert view_res.json()["title"] == "ThinkSpace Case Study #1"

    sub1_res = client.post(
        f"/api/submissions/assignment/{assignment_id}",
        data={
            "text_content": "This is my primary thesis on regional connectivity and economic synergy in Central Asia.",
            "link_url": "https://thinkspace.uwed.uz/research-v1"
        },
        headers=member_headers
    )
    assert sub1_res.status_code == 200
    sub1_data = sub1_res.json()
    assert sub1_data["status"] == "submitted"
    submission_id = sub1_data["id"]

    sub2_res = client.post(
        f"/api/submissions/assignment/{assignment_id}",
        data={
            "text_content": "Updated analysis with new empirical trade statistics from SIEM UWED.",
            "link_url": "https://thinkspace.uwed.uz/research-v2"
        },
        headers=member_headers
    )
    assert sub2_res.status_code == 200

    detail_res = client.get(f"/api/submissions/{submission_id}", headers=member_headers)
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert len(detail_data["versions"]) == 2
    assert detail_data["versions"][0]["version_number"] == 1
    assert detail_data["versions"][1]["version_number"] == 2
    assert "Updated analysis" in detail_data["versions"][1]["text_content"]
