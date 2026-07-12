from fastapi import APIRouter, HTTPException

from app.models.schemas import FeedbackOut

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("/{session_id}/generate", response_model=FeedbackOut)
def generate_feedback(session_id: str):
    """Run the full analysis pipeline: transcription -> content scoring -> body language.

    Implemented incrementally across build phases 2-4.
    """
    raise HTTPException(status_code=501, detail="Not implemented yet: build phases 2-4")


@router.get("/{session_id}", response_model=FeedbackOut)
def get_feedback(session_id: str):
    """Implemented alongside the pipeline in build phases 2-4."""
    raise HTTPException(status_code=501, detail="Not implemented yet: build phases 2-4")
