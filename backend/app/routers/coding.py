import time

from fastapi import APIRouter, Depends, HTTPException

from app.data.coding_problems import CODING_PROBLEMS
from app.models.schemas import CodeSubmission, CodingProblem, SubmissionResult
from app.services.auth import get_current_user_id
from app.services.code_judge import run_submission

router = APIRouter(prefix="/api/coding-problems", tags=["coding"])

DAILY_SUBMISSION_QUOTA = 10
_DAY_SECONDS = 24 * 60 * 60

# In-memory per-process rate limit (no DB table for this, per design — resets
# on backend restart, which is an acceptable tradeoff at this project's scale).
_submission_log: dict[str, list[float]] = {}


def _check_and_record_quota(user_id: str) -> None:
    now = time.time()
    recent = [t for t in _submission_log.get(user_id, []) if now - t < _DAY_SECONDS]
    if len(recent) >= DAILY_SUBMISSION_QUOTA:
        raise HTTPException(status_code=429, detail="Daily submission quota exceeded")
    recent.append(now)
    _submission_log[user_id] = recent


def _to_problem_out(problem: dict) -> CodingProblem:
    return CodingProblem(
        id=problem["id"],
        title=problem["title"],
        description=problem["description"],
        starter_code=problem["starter_code"],
    )


@router.get("", response_model=list[CodingProblem])
def list_problems():
    return [_to_problem_out(p) for p in CODING_PROBLEMS]


@router.get("/{problem_id}", response_model=CodingProblem)
def get_problem(problem_id: int):
    problem = next((p for p in CODING_PROBLEMS if p["id"] == problem_id), None)
    if problem is None:
        raise HTTPException(status_code=404, detail="Problem not found")
    return _to_problem_out(problem)


@router.post("/{problem_id}/submit", response_model=SubmissionResult)
def submit_solution(
    problem_id: int,
    body: CodeSubmission,
    user_id: str = Depends(get_current_user_id),
):
    if not any(p["id"] == problem_id for p in CODING_PROBLEMS):
        raise HTTPException(status_code=404, detail="Problem not found")

    _check_and_record_quota(user_id)

    try:
        return run_submission(problem_id, body.code)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Submission failed: {exc}") from exc
