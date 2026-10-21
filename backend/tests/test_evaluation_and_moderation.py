"""
Tests for multi-admin rubric evaluation, discrepancy detection, moderator approval,
grade publishing, revisions, and member appeals.
"""
from datetime import datetime, timezone, timedelta
from starlette.testclient import TestClient

def test_full_evaluation_to_published_grade_and_appeal_flow(
    client: TestClient,
    evaluator_token: str,
    moderator_token: str,
    member_token: str
):
    eval_headers = {"Authorization": f"Bearer {evaluator_token}"}
    mod_headers = {"Authorization": f"Bearer {moderator_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # 1. Create assignment with 2 criteria
    assign_payload = {
        "title": "Think & Read Book Review",
        "direction": "Think & Read",
        "description": "Critical reflection on 'Why Nations Fail'.",
        "instructions": "Evaluate the institutional thesis in 800 words.",
        "status": "open",
        "deadline_at": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        "max_score": 100,
        "min_evaluators": 1,
        "requires_moderation": True,
        "criteria": [
            {"title": "Analytical Depth", "max_points": 60, "order_index": 1},
            {"title": "Clarity of Argument", "max_points": 40, "order_index": 2}
        ]
    }
    assign_res = client.post("/api/assignments", json=assign_payload, headers=eval_headers)
    assert assign_res.status_code == 201
    assign_data = assign_res.json()
    assignment_id = assign_data["id"]
    criteria = assign_data["active_rubric"]["criteria"]
    crit1_id = criteria[0]["id"]
    crit2_id = criteria[1]["id"]

    # 2. Member submits work
    sub_res = client.post(
        f"/api/submissions/assignment/{assignment_id}",
        data={"text_content": "Detailed critique of inclusive vs extractive institutions."},
        headers=member_headers
    )
    assert sub_res.status_code == 200
    submission_id = sub_res.json()["id"]

    # 3. Evaluator tests invalid score (greater than criterion max_points)
    invalid_eval_payload = {
        "submission_id": submission_id,
        "general_feedback": "Thorough paper.",
        "is_draft": False,
        "criterion_scores": [
            {"criterion_id": crit1_id, "score": 75.0},
            {"criterion_id": crit2_id, "score": 35.0}
        ]
    }
    err_eval_res = client.post("/api/evaluations", json=invalid_eval_payload, headers=eval_headers)
    assert err_eval_res.status_code == 400

    # 4. Evaluator submits valid evaluation
    valid_eval_payload = {
        "submission_id": submission_id,
        "general_feedback": "Excellent thesis and strong grasp of institutional theory.",
        "is_draft": False,
        "criterion_scores": [
            {"criterion_id": crit1_id, "score": 55.0, "comment": "Compelling analysis."},
            {"criterion_id": crit2_id, "score": 35.0, "comment": "Clear structure."}
        ]
    }
    eval_res = client.post("/api/evaluations", json=valid_eval_payload, headers=eval_headers)
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["total_score"] == 90.0

    # 5. Check submission status: awaiting_moderator
    sub_check_res = client.get(f"/api/submissions/{submission_id}", headers=mod_headers)
    assert sub_check_res.json()["status"] == "awaiting_moderator"

    # 6. Moderator approves the evaluation
    mod_dec_res = client.post(
        f"/api/moderation/submissions/{submission_id}/decision",
        json={
            "decision": "approved",
            "rationale": "High quality submission confirmed by moderation team."
        },
        headers=mod_headers
    )
    assert mod_dec_res.status_code == 200

    # 7. Publish final grade
    pub_res = client.post(
        f"/api/moderation/submissions/{submission_id}/publish-grade",
        headers=mod_headers
    )
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["final_score"] == 90.0
    assert pub_data["percentage"] == 90.0
    published_grade_id = pub_data["id"]

    # 8. Member now sees published grade
    my_sub_res = client.get(f"/api/submissions/assignment/{assignment_id}/my-submission", headers=member_headers)
    assert my_sub_res.status_code == 200
    assert my_sub_res.json()["status"] == "published"

    # 9. Member submits an appeal (review request)
    appeal_res = client.post(
        f"/api/moderation/published-grades/{published_grade_id}/appeal",
        json={"reason": "Please reconsider criterion 2 as citations were fully included in footnotes."},
        headers=member_headers
    )
    assert appeal_res.status_code == 200
    appeal_id = appeal_res.json()["id"]

    # 10. Moderator resolves appeal with adjustment (+3 points -> 93.0)
    resolve_res = client.post(
        f"/api/moderation/appeals/{appeal_id}/resolve",
        json={
            "action": "resolve",
            "resolution_comment": "Footnotes verified. Adjusted score to 93.0.",
            "adjusted_score": 93.0
        },
        headers=mod_headers
    )
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "resolved"
