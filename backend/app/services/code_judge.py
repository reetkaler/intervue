import base64
import time
from functools import lru_cache

import httpx

from app.config import settings
from app.data.coding_problems import CODING_PROBLEMS
from app.models.schemas import SubmissionResult, TestCaseResult

JUDGE0_BASE_URL = "https://judge0-ce.p.rapidapi.com"
STATUS_ACCEPTED = 3
STATUS_IN_QUEUE = 1
STATUS_PROCESSING = 2


def _headers() -> dict:
    return {
        "X-RapidAPI-Key": settings.judge0_api_key,
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        "Content-Type": "application/json",
    }


@lru_cache(maxsize=1)
def _python_language_id() -> int:
    resp = httpx.get(f"{JUDGE0_BASE_URL}/languages", headers=_headers(), timeout=15)
    resp.raise_for_status()
    for lang in resp.json():
        if lang["name"].startswith("Python (3"):
            return lang["id"]
    raise RuntimeError("Could not find a Python 3 runtime on Judge0")


def _b64(s: str) -> str:
    return base64.b64encode(s.encode()).decode()


def _decode(value: str | None) -> str:
    if not value:
        return ""
    try:
        return base64.b64decode(value).decode(errors="replace")
    except Exception:
        return value


def run_submission(problem_id: int, source_code: str) -> SubmissionResult:
    problem = next((p for p in CODING_PROBLEMS if p["id"] == problem_id), None)
    if problem is None:
        raise ValueError(f"Unknown coding problem id {problem_id}")

    language_id = _python_language_id()
    submissions = [
        {
            "source_code": _b64(f"{problem['harness']}{source_code}\nprint({tc['call']})"),
            "language_id": language_id,
            "expected_output": _b64(tc["expected_output"]),
        }
        for tc in problem["test_cases"]
    ]

    resp = httpx.post(
        f"{JUDGE0_BASE_URL}/submissions/batch",
        params={"base64_encoded": "true", "wait": "true"},
        headers=_headers(),
        json={"submissions": submissions},
        timeout=30,
    )
    resp.raise_for_status()
    results = resp.json()

    # If wait=true didn't fully synchronize the batch, poll using the tokens.
    if any("status" not in r for r in results):
        tokens = ",".join(r["token"] for r in results)
        results = _poll_batch(tokens)

    test_results = []
    all_passed = True
    for tc, result in zip(problem["test_cases"], results):
        status = result.get("status") or {}
        passed = status.get("id") == STATUS_ACCEPTED
        all_passed = all_passed and passed
        test_results.append(
            TestCaseResult(
                call=tc["call"],
                passed=passed,
                status=status.get("description", "Unknown"),
                stdout=_decode(result.get("stdout")),
                stderr=_decode(result.get("stderr") or result.get("compile_output")),
            )
        )

    return SubmissionResult(all_passed=all_passed, test_results=test_results)


def _poll_batch(tokens: str, attempts: int = 10, delay: float = 1.0) -> list[dict]:
    for _ in range(attempts):
        resp = httpx.get(
            f"{JUDGE0_BASE_URL}/submissions/batch",
            params={
                "tokens": tokens,
                "base64_encoded": "true",
                "fields": "status,stdout,stderr,compile_output",
            },
            headers=_headers(),
            timeout=15,
        )
        resp.raise_for_status()
        results = resp.json()["submissions"]
        pending_states = (STATUS_IN_QUEUE, STATUS_PROCESSING)
        if all((r.get("status") or {}).get("id") not in pending_states for r in results):
            return results
        time.sleep(delay)
    return results
