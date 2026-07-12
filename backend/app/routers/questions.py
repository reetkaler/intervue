from fastapi import APIRouter, HTTPException

from app.data.questions import QUESTIONS
from app.models.schemas import Question

router = APIRouter(prefix="/api/questions", tags=["questions"])


@router.get("", response_model=list[Question])
def list_questions():
    return QUESTIONS


@router.get("/{question_id}", response_model=Question)
def get_question(question_id: int):
    for q in QUESTIONS:
        if q["id"] == question_id:
            return q
    raise HTTPException(status_code=404, detail="Question not found")
