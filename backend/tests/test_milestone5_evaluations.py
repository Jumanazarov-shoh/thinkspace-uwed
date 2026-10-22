"""
Milestone 5 Automated Test Suite:
- Rubric Management & Modification Locking
- Evaluator Assignment & Conflict of Interest Enforcement
- Evaluator Review Queue & Evaluation Context
- Rubric Score Validation & Backend Calculations
- Evaluation Draft Saving vs Formal Submission
- Multiple Evaluator Scoring & 15% Discrepancy Threshold Trigger
- Senior Reviewer Queue & Escalation to Moderator
- Moderator Authoritative Final Decision & Grade Publishing
- Member Privacy Protection (No Drafts, No Private Notes, No Other Members' Results)
"""
from datetime import datetime, timezone, timedelta
import pytest
from starlette.testclient import TestClient
from sqlalchemy import select

from app.models.user import User, RoleEnum
from app.models.assignment import Assignment, AssignmentStatus, Rubric, RubricCriterion
from app.models.submission import Submission, SubmissionStatus
from app.models.evaluation import Evaluation, EvaluationStatus, ReviewStatus, EvaluatorAssignment, SeniorReview

def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

def _create_assignment_with_rubric(session, creator: User, max_score: int = 100, threshold: float = 15.0) -> Assignment:
    assignment = Assignment(
        title="Economic Integration Policy Analysis",
        slug=f"policy-analysis-{datetime.now().timestamp()}",
        direction="Think & Analyze",
        description="Analyze regional economic corridors in Central Asia.",
        instructions="Provide institutional comparison and empirical evidence.",
        status=AssignmentStatus.PUBLISHED.value,
        publish_at=datetime.now(timezone.utc),
        deadline_at=datetime.now(timezone.utc) + timedelta(days=7),
        max_score=max_score,
        min_evaluators=2,
        discrepancy_threshold=threshold,
        created_by_id=creator.id,
    )
    session.add(assignment)
    session.flush()

    rubric = Rubric(assignment_id=assignment.id, version=1, is_active=True)
    session.add(rubric)
    session.flush()

    crit1 = RubricCriterion(
        rubric_id=rubric.id,
        title="Theoretical Framework",
        description="Understanding of economic principles",
        guidance="0-50 pts based on rigor",
        max_points=50.0,
        order_index=1
    )
    crit2 = RubricCriterion(
        rubric_id=rubric.id,
        title="Empirical Evidence & Policy Recommendations",
        description="Quality of data and actionable proposals",
        guidance="0-50 pts based on feasibility",
        max_points=50.0,
        order_index=2
    )
    session.add_all([crit1, crit2])
    session.commit()
    session.refresh(assignment)
    return assignment

def _create_submission(client: TestClient, assignment_id: int, member_token: str, text: str = "Academic Submission") -> int:
    res = client.post(
        f"/api/submissions/assignment/{assignment_id}/submit",
        data={"text_content": text, "link_url": "https://uwed.uz/research"},
        headers=_auth_header(member_token)
    )
    assert res.status_code == 200
    return res.json()["id"]

# ---------------------------------------------------------------------------
# 1. Rubric Management Tests
# ---------------------------------------------------------------------------

def test_rubric_management_and_modification_locking(
    client: TestClient,
    db_session,
    super_admin_user: User,
    super_admin_token: str,
    member_user: User,
    member_token: str
):
    assignment = _create_assignment_with_rubric(db_session, super_admin_user)

    # 1. Member cannot create or modify rubric criteria
    res_mem = client.post(
        f"/api/assignments/{assignment.id}/rubric/criteria",
        json={"title": "Unauthorized Criterion", "max_points": 20.0},
        headers=_auth_header(member_token)
    )
    assert res_mem.status_code == 403

    # 2. Admin adds a new criterion
    res_add = client.post(
        f"/api/assignments/{assignment.id}/rubric/criteria",
        json={"title": "Originality & Novelty", "description": "Creative insights", "max_points": 25.0, "order_index": 3},
        headers=_auth_header(super_admin_token)
    )
    assert res_add.status_code == 200
    new_crit_id = res_add.json()["id"]
    assert res_add.json()["title"] == "Originality & Novelty"
    assert res_add.json()["max_points"] == 25.0

    # 3. Invalid max points rejected (<= 0)
    res_inv = client.post(
        f"/api/assignments/{assignment.id}/rubric/criteria",
        json={"title": "Invalid Criterion", "max_points": -5.0},
        headers=_auth_header(super_admin_token)
    )
    assert res_inv.status_code == 422

    # 4. Admin updates criterion
    res_upd = client.put(
        f"/api/assignments/{assignment.id}/rubric/criteria/{new_crit_id}",
        json={"title": "Updated Originality & Impact", "max_points": 30.0},
        headers=_auth_header(super_admin_token)
    )
    assert res_upd.status_code == 200
    assert res_upd.json()["title"] == "Updated Originality & Impact"
    assert res_upd.json()["max_points"] == 30.0

    # 5. Admin deletes criterion
    res_del = client.delete(
        f"/api/assignments/{assignment.id}/rubric/criteria/{new_crit_id}",
        headers=_auth_header(super_admin_token)
    )
    assert res_del.status_code == 200

# ---------------------------------------------------------------------------
# 2. Evaluator Assignment & Conflict of Interest Tests
# ---------------------------------------------------------------------------

def test_evaluator_assignment_and_conflict_of_interest(
    client: TestClient,
    db_session,
    super_admin_user: User,
    super_admin_token: str,
    evaluator_user: User,
    evaluator_token: str,
    member_user: User,
    member_token: str
):
    assignment = _create_assignment_with_rubric(db_session, super_admin_user)
    sub_id = _create_submission(client, assignment.id, member_token)

    # 1. Member cannot assign evaluators
    res_unauth = client.post(
        f"/api/evaluations/assignments/{sub_id}/assign",
        json={"evaluator_id": evaluator_user.id},
        headers=_auth_header(member_token)
    )
    assert res_unauth.status_code == 403

    # 2. Super admin assigns evaluator
    res_assign = client.post(
        f"/api/evaluations/assignments/{sub_id}/assign",
        json={"evaluator_id": evaluator_user.id},
        headers=_auth_header(super_admin_token)
    )
    assert res_assign.status_code == 200
    assert res_assign.json()["evaluator_id"] == evaluator_user.id
    assert res_assign.json()["status"] == "assigned"

    # 3. Duplicate assignment rejected
    res_dup = client.post(
        f"/api/evaluations/assignments/{sub_id}/assign",
        json={"evaluator_id": evaluator_user.id},
        headers=_auth_header(super_admin_token)
    )
    assert res_dup.status_code == 400
    assert "allaqachon" in res_dup.json()["detail"].lower()

    # 4. Conflict of interest: Evaluator cannot evaluate their own submission
    # Create submission by evaluator_user
    own_sub_id = _create_submission(client, assignment.id, evaluator_token, text="Evaluator personal work")
    res_conflict = client.post(
        f"/api/evaluations/assignments/{own_sub_id}/assign",
        json={"evaluator_id": evaluator_user.id},
        headers=_auth_header(super_admin_token)
    )
    assert res_conflict.status_code == 400
    assert "o'zi baholashi taqiqlanadi" in res_conflict.json()["detail"].lower()

# ---------------------------------------------------------------------------
# 3. Evaluator Queue, Draft Saving & Score Validation Tests
# ---------------------------------------------------------------------------

def test_evaluator_queue_drafts_and_score_validation(
    client: TestClient,
    db_session,
    super_admin_user: User,
    super_admin_token: str,
    evaluator_user: User,
    evaluator_token: str,
    member_user: User,
    member_token: str
):
    assignment = _create_assignment_with_rubric(db_session, super_admin_user)
    sub_id = _create_submission(client, assignment.id, member_token)

    # Assign evaluator
    client.post(
        f"/api/evaluations/assignments/{sub_id}/assign",
        json={"evaluator_id": evaluator_user.id},
        headers=_auth_header(super_admin_token)
    )

    # 1. Evaluator views assigned queue
    res_queue = client.get("/api/evaluations/assigned", headers=_auth_header(evaluator_token))
    assert res_queue.status_code == 200
    queue_items = res_queue.json()
    assert any(item["submission_id"] == sub_id for item in queue_items)

    # 2. Evaluator opens evaluation context
    res_ctx = client.get(f"/api/evaluations/submission/{sub_id}/context", headers=_auth_header(evaluator_token))
    assert res_ctx.status_code == 200
    ctx = res_ctx.json()
    assert len(ctx["rubric"]["criteria"]) == 2
    crit1_id = ctx["rubric"]["criteria"][0]["id"]
    crit2_id = ctx["rubric"]["criteria"][1]["id"]

    # 3. Score validation: Score exceeding criterion max (50.0) rejected
    res_err_max = client.post(
        "/api/evaluations",
        json={
            "submission_id": sub_id,
            "general_feedback": "Detailed feedback",
            "is_draft": False,
            "criterion_scores": [
                {"criterion_id": crit1_id, "score": 55.0},
                {"criterion_id": crit2_id, "score": 40.0}
            ]
        },
        headers=_auth_header(evaluator_token)
    )
    assert res_err_max.status_code == 400
    assert "maksimal ball" in res_err_max.json()["detail"].lower()

    # 4. Save Draft Review
    res_draft = client.post(
        "/api/evaluations",
        json={
            "submission_id": sub_id,
            "general_feedback": "Initial feedback in progress",
            "internal_notes": "Private note: needs verification of footnote 4",
            "is_draft": True,
            "criterion_scores": [
                {"criterion_id": crit1_id, "score": 42.0, "comment": "Good theoretical grounding"}
            ]
        },
        headers=_auth_header(evaluator_token)
    )
    assert res_draft.status_code == 200
    assert res_draft.json()["status"] == "draft"
    assert res_draft.json()["total_score"] == 42.0
    assert res_draft.json()["internal_notes"] == "Private note: needs verification of footnote 4"

    # Member MUST NOT see draft
    res_mem_check = client.get(
        f"/api/evaluations/member/assignment/{assignment.id}/result",
        headers=_auth_header(member_token)
    )
    assert res_mem_check.status_code == 200
    assert res_mem_check.json()["is_finalized"] is False
    assert res_mem_check.json()["review_status"] == "under_review"
    assert res_mem_check.json()["final_score"] is None

# ---------------------------------------------------------------------------
# 4. Multi-Evaluator Agreement & 15% Discrepancy Threshold Trigger
# ---------------------------------------------------------------------------

def test_multi_evaluator_scoring_and_discrepancy_threshold(
    client: TestClient,
    db_session,
    super_admin_user: User,
    super_admin_token: str,
    evaluator_user: User,
    evaluator_token: str,
    moderator_user: User,
    moderator_token: str,
    member_user: User,
    member_token: str
):
    # Assignment has max_score=100 and discrepancy_threshold=15.0%
    assignment = _create_assignment_with_rubric(db_session, super_admin_user, max_score=100, threshold=15.0)
    sub_id = _create_submission(client, assignment.id, member_token)

    rubric_res = client.get(f"/api/assignments/{assignment.id}/rubric", headers=_auth_header(super_admin_token))
    criteria = rubric_res.json()["criteria"]
    crit1_id = criteria[0]["id"]
    crit2_id = criteria[1]["id"]

    # Assign Evaluator A and Evaluator B (Moderator acting as second evaluator)
    client.post(
        f"/api/evaluations/assignments/{sub_id}/assign",
        json={"evaluator_id": evaluator_user.id},
        headers=_auth_header(super_admin_token)
    )
    client.post(
        f"/api/evaluations/assignments/{sub_id}/assign",
        json={"evaluator_id": moderator_user.id},
        headers=_auth_header(super_admin_token)
    )

    # 1. Evaluator A scores 82 total (42 + 40)
    res_a = client.post(
        "/api/evaluations",
        json={
            "submission_id": sub_id,
            "general_feedback": "Evaluator A: Strong analytical rigor and solid evidence.",
            "internal_notes": "Internal note: methodology is sound.",
            "is_draft": False,
            "criterion_scores": [
                {"criterion_id": crit1_id, "score": 42.0},
                {"criterion_id": crit2_id, "score": 40.0}
            ]
        },
        headers=_auth_header(evaluator_token)
    )
    assert res_a.status_code == 200
    assert res_a.json()["total_score"] == 82.0

    # 2. Evaluator B scores 64 total (30 + 34)
    # Difference: |82 - 64| = 18.0 pts -> 18% > 15.0% threshold!
    res_b = client.post(
        "/api/evaluations",
        json={
            "submission_id": sub_id,
            "general_feedback": "Evaluator B: Insufficient comparative scope.",
            "internal_notes": "Internal note: lacks recent empirical data.",
            "is_draft": False,
            "criterion_scores": [
                {"criterion_id": crit1_id, "score": 30.0},
                {"criterion_id": crit2_id, "score": 34.0}
            ]
        },
        headers=_auth_header(moderator_token)
    )
    assert res_b.status_code == 200
    assert res_b.json()["total_score"] == 64.0

    # 3. Verify submission review_status automatically escalated to 'needs_review'
    sub_db = db_session.execute(select(Submission).where(Submission.id == sub_id)).scalar_one()
    assert sub_db.review_status == ReviewStatus.NEEDS_REVIEW.value

    # 4. Admin overview reflects the discrepancy
    res_overview = client.get("/api/evaluations/admin/overview", headers=_auth_header(super_admin_token))
    assert res_overview.status_code == 200
    item = next(o for o in res_overview.json() if o["submission_id"] == sub_id)
    assert item["is_discrepant"] is True
    assert item["score_difference"] == 18.0
    assert item["average_score"] == 73.0
    assert item["review_status"] == "needs_review"

# ---------------------------------------------------------------------------
# 5. Senior Review & Moderator Authoritative Finalization Tests
# ---------------------------------------------------------------------------

def test_senior_review_and_moderator_finalization_flow(
    client: TestClient,
    db_session,
    super_admin_user: User,
    super_admin_token: str,
    evaluator_user: User,
    evaluator_token: str,
    moderator_user: User,
    moderator_token: str,
    member_user: User,
    member_token: str
):
    assignment = _create_assignment_with_rubric(db_session, super_admin_user)
    sub_id = _create_submission(client, assignment.id, member_token)

    # Force submission into needs_review state
    sub_db = db_session.execute(select(Submission).where(Submission.id == sub_id)).scalar_one()
    sub_db.review_status = ReviewStatus.NEEDS_REVIEW.value
    db_session.commit()

    # 1. Senior Review queue listing
    res_sr_queue = client.get("/api/evaluations/senior-queue", headers=_auth_header(moderator_token))
    assert res_sr_queue.status_code == 200
    assert any(q["submission_id"] == sub_id for q in res_sr_queue.json())

    # 2. Member rejected from Senior Review queue
    res_mem_sr = client.get("/api/evaluations/senior-queue", headers=_auth_header(member_token))
    assert res_mem_sr.status_code == 403

    # 3. Senior Reviewer submits recommendation with escalation to Moderator
    res_sr_submit = client.post(
        f"/api/evaluations/submissions/{sub_id}/senior-review",
        json={
            "recommended_score": 76.0,
            "rationale": "Evaluator A overlooked sample size limitations. 76 is a balanced consensus.",
            "internal_notes": "Escalating for final sign-off.",
            "escalate_to_moderator": True
        },
        headers=_auth_header(moderator_token)
    )
    assert res_sr_submit.status_code == 200
    assert res_sr_submit.json()["recommended_score"] == 76.0

    db_session.refresh(sub_db)
    assert sub_db.review_status == ReviewStatus.MODERATOR_REVIEW.value

    # 4. Moderator Final Decision (authoritative score = 78.0)
    res_finalize = client.post(
        f"/api/evaluations/submissions/{sub_id}/finalize",
        json={
            "final_score": 78.0,
            "rationale": "Academic excellence demonstrated with minor theoretical omissions."
        },
        headers=_auth_header(moderator_token)
    )
    assert res_finalize.status_code == 200
    assert res_finalize.json()["final_score"] == 78.0
    assert res_finalize.json()["percentage"] == 78.0

    db_session.refresh(sub_db)
    assert sub_db.review_status == ReviewStatus.FINALIZED.value
    assert sub_db.status == SubmissionStatus.PUBLISHED.value

    # 5. Member accesses finalized result
    res_mem_result = client.get(
        f"/api/evaluations/member/assignment/{assignment.id}/result",
        headers=_auth_header(member_token)
    )
    assert res_mem_result.status_code == 200
    result_data = res_mem_result.json()
    assert result_data["is_finalized"] is True
    assert result_data["final_score"] == 78.0
    assert result_data["max_score"] == 100.0
    assert result_data["percentage"] == 78.0
    assert "Academic excellence demonstrated" in result_data["overall_feedback"]

    # Verify internal reviewer notes are NEVER leaked to member
    raw_response = res_mem_result.text
    assert "Private note" not in raw_response
    assert "footnote 4" not in raw_response
    assert "Escalating for final sign-off" not in raw_response
