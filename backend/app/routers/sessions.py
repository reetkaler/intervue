from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import SessionCreate, SessionOut
from app.services.auth import get_current_user_id
from app.services.supabase_client import admin_client

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

DAILY_SESSION_QUOTA = 15


@router.post("", response_model=SessionOut)
def create_session(body: SessionCreate, user_id: str = Depends(get_current_user_id)):
    if not body.video_path.startswith(f"{user_id}/"):
        raise HTTPException(status_code=403, detail="video_path does not belong to this user")

    if not (0 < body.duration_seconds <= 180):
        raise HTTPException(status_code=400, detail="duration_seconds must be between 1 and 180")

    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    count_resp = (
        admin_client.table("sessions")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("created_at", since)
        .execute()
    )
    if (count_resp.count or 0) >= DAILY_SESSION_QUOTA:
        raise HTTPException(status_code=429, detail="Daily session quota exceeded")

    insert_resp = (
        admin_client.table("sessions")
        .insert(
            {
                "user_id": user_id,
                "question_id": body.question_id,
                "video_path": body.video_path,
                "duration_seconds": body.duration_seconds,
                "status": "pending",
            }
        )
        .execute()
    )
    return insert_resp.data[0]


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: str, user_id: str = Depends(get_current_user_id)):
    resp = admin_client.table("sessions").select("*").eq("id", session_id).execute()
    if not resp.data or resp.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Session not found")
    return resp.data[0]
