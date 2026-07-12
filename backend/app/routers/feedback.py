import os

from fastapi import APIRouter, Depends, HTTPException

from app.data.questions import QUESTIONS
from app.models.schemas import BodyLanguageStats, ContentFeedback, FeedbackOut
from app.services.auth import get_current_user_id
from app.services.content_scoring import score_content
from app.services.delivery import compute_delivery_stats
from app.services.supabase_client import admin_client
from app.services.transcription import transcribe

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

WHISPER_MAX_BYTES = 26_214_400  # OpenAI's hard upload limit for audio transcription


def _get_owned_session(session_id: str, user_id: str) -> dict:
    resp = admin_client.table("sessions").select("*").eq("id", session_id).execute()
    if not resp.data or resp.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Session not found")
    return resp.data[0]


def _to_feedback_out(row: dict) -> FeedbackOut:
    return FeedbackOut(
        session_id=row["session_id"],
        transcript=row["transcript"],
        delivery=row["delivery"],
        content=ContentFeedback(**row["content"]) if row["content"] else None,
        body_language=BodyLanguageStats(**row["body_language"]) if row["body_language"] else None,
        created_at=row["created_at"],
    )


@router.post("/{session_id}/generate", response_model=FeedbackOut)
def generate_feedback(session_id: str, user_id: str = Depends(get_current_user_id)):
    """Run the full analysis pipeline: transcription -> content scoring -> body language.

    Currently implements phases 2-3 (transcription, delivery stats, content
    scoring). Body language remains unset until phase 4.
    """
    session = _get_owned_session(session_id, user_id)

    if session["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"Session is already {session['status']}")

    admin_client.table("sessions").update({"status": "processing"}).eq("id", session_id).execute()

    try:
        video_bytes = admin_client.storage.from_("recordings").download(session["video_path"])
        if len(video_bytes) > WHISPER_MAX_BYTES:
            raise ValueError(
                f"Recording is {len(video_bytes) / 1_048_576:.1f}MB, over Whisper's 25MB limit"
            )
        transcript = transcribe(video_bytes, filename=os.path.basename(session["video_path"]))
        delivery = compute_delivery_stats(transcript, session["duration_seconds"])

        question = next((q for q in QUESTIONS if q["id"] == session["question_id"]), None)
        question_text = question["text"] if question else "Unknown interview question"
        content = score_content(question_text, transcript)

        feedback_resp = (
            admin_client.table("feedback")
            .upsert(
                {
                    "session_id": session_id,
                    "transcript": transcript,
                    "delivery": delivery.model_dump(),
                    "content": content.model_dump(),
                }
            )
            .execute()
        )
        admin_client.table("sessions").update({"status": "complete"}).eq("id", session_id).execute()
    except Exception as exc:
        admin_client.table("sessions").update({"status": "failed"}).eq("id", session_id).execute()
        raise HTTPException(status_code=500, detail=f"Feedback generation failed: {exc}") from exc

    return _to_feedback_out(feedback_resp.data[0])


@router.get("/{session_id}", response_model=FeedbackOut)
def get_feedback(session_id: str, user_id: str = Depends(get_current_user_id)):
    _get_owned_session(session_id, user_id)

    resp = admin_client.table("feedback").select("*").eq("session_id", session_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return _to_feedback_out(resp.data[0])
