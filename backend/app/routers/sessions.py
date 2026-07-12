from fastapi import APIRouter, HTTPException, UploadFile

from app.models.schemas import SessionOut

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=SessionOut)
def create_session(question_id: int, video: UploadFile):
    """Upload a recording and create a session row.

    Implemented in build phase 1 (recording + upload pipeline):
    store `video` in Supabase Storage and insert a `sessions` row.
    """
    raise HTTPException(status_code=501, detail="Not implemented yet: build phase 1")


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: str):
    """Implemented in build phase 1."""
    raise HTTPException(status_code=501, detail="Not implemented yet: build phase 1")
