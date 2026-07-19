import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.data.coding_problems import CODING_PROBLEMS
from app.models.schemas import (
    CodingFeedback,
    CodingFeedbackOut,
    CodingSessionCreate,
    CodingSessionOut,
    SubmissionResult,
)
from app.services.auth import get_current_user_id
from app.services.code_judge import run_submission
from app.services.coding_feedback import score_coding_explanation
from app.services.supabase_client import admin_client
from app.services.transcription import transcribe

router = APIRouter(prefix="/api/coding-sessions", tags=["coding-sessions"])

DAILY_CODING_SESSION_QUOTA = 5
WHISPER_MAX_BYTES = 26_214_400  # OpenAI's hard upload limit for audio transcription


def _get_owned_session(session_id: str, user_id: str) -> dict:
    resp = admin_client.table("coding_sessions").select("*").eq("id", session_id).execute()
    if not resp.data or resp.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Coding session not found")
    return resp.data[0]


def _to_feedback_out(row: dict) -> CodingFeedbackOut:
    return CodingFeedbackOut(
        coding_session_id=row["coding_session_id"],
        transcript=row["transcript"],
        test_results=SubmissionResult(**row["test_results"]),
        score_feedback=CodingFeedback(**row["score_feedback"]),
        created_at=row["created_at"],
    )


@router.post("", response_model=CodingSessionOut)
def create_coding_session(body: CodingSessionCreate, user_id: str = Depends(get_current_user_id)):
    if not body.audio_path.startswith(f"{user_id}/"):
        raise HTTPException(status_code=403, detail="audio_path does not belong to this user")

    if not (0 < body.duration_seconds <= 360):
        raise HTTPException(status_code=400, detail="duration_seconds must be between 1 and 360")

    if not any(p["id"] == body.problem_id for p in CODING_PROBLEMS):
        raise HTTPException(status_code=404, detail="Problem not found")

    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    count_resp = (
        admin_client.table("coding_sessions")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("created_at", since)
        .execute()
    )
    if (count_resp.count or 0) >= DAILY_CODING_SESSION_QUOTA:
        raise HTTPException(status_code=429, detail="Daily coding-session quota exceeded")

    insert_resp = (
        admin_client.table("coding_sessions")
        .insert(
            {
                "user_id": user_id,
                "problem_id": body.problem_id,
                "audio_path": body.audio_path,
                "duration_seconds": body.duration_seconds,
                "code": body.code,
                "status": "pending",
            }
        )
        .execute()
    )
    return insert_resp.data[0]


@router.get("/{session_id}", response_model=CodingSessionOut)
def get_coding_session(session_id: str, user_id: str = Depends(get_current_user_id)):
    return _get_owned_session(session_id, user_id)


@router.post("/{session_id}/generate", response_model=CodingFeedbackOut)
def generate_coding_feedback(session_id: str, user_id: str = Depends(get_current_user_id)):
    """Run the full pipeline: transcription -> re-run judge -> combined explanation+correctness scoring."""
    session = _get_owned_session(session_id, user_id)

    if session["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"Coding session is already {session['status']}")

    admin_client.table("coding_sessions").update({"status": "processing"}).eq("id", session_id).execute()

    try:
        audio_bytes = admin_client.storage.from_("recordings").download(session["audio_path"])
        if len(audio_bytes) > WHISPER_MAX_BYTES:
            raise ValueError(
                f"Recording is {len(audio_bytes) / 1_048_576:.1f}MB, over Whisper's 25MB limit"
            )
        transcript = transcribe(audio_bytes, filename=os.path.basename(session["audio_path"]))

        problem = next((p for p in CODING_PROBLEMS if p["id"] == session["problem_id"]), None)
        problem_description = problem["description"] if problem else "Unknown coding problem"

        # Re-run the judge server-side rather than trusting client-supplied
        # results, so the graded code always matches what's actually stored.
        test_results = run_submission(session["problem_id"], session["code"])

        score_feedback = score_coding_explanation(
            problem_description, transcript, session["code"], test_results
        )

        feedback_resp = (
            admin_client.table("coding_feedback")
            .upsert(
                {
                    "coding_session_id": session_id,
                    "transcript": transcript,
                    "test_results": test_results.model_dump(),
                    "score_feedback": score_feedback.model_dump(),
                }
            )
            .execute()
        )
        admin_client.table("coding_sessions").update({"status": "complete"}).eq("id", session_id).execute()
    except Exception as exc:
        admin_client.table("coding_sessions").update({"status": "failed"}).eq("id", session_id).execute()
        raise HTTPException(status_code=500, detail=f"Coding feedback generation failed: {exc}") from exc

    return _to_feedback_out(feedback_resp.data[0])


@router.get("/{session_id}/feedback", response_model=CodingFeedbackOut)
def get_coding_feedback(session_id: str, user_id: str = Depends(get_current_user_id)):
    _get_owned_session(session_id, user_id)

    resp = admin_client.table("coding_feedback").select("*").eq("coding_session_id", session_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return _to_feedback_out(resp.data[0])
