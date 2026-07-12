from typing import Literal, Optional
from pydantic import BaseModel


class Question(BaseModel):
    id: int
    type: Literal["behavioral", "technical"]
    text: str


class SessionCreate(BaseModel):
    question_id: int
    video_path: str
    duration_seconds: int


class SessionOut(BaseModel):
    id: str
    user_id: str
    question_id: int
    video_path: str
    duration_seconds: int
    status: Literal["pending", "processing", "complete", "failed"]
    created_at: str


class DeliveryStats(BaseModel):
    words_per_minute: float
    filler_word_count: int


class ContentFeedback(BaseModel):
    score: int
    strengths: list[str]
    improvements: list[str]
    summary: str


class BodyLanguageStats(BaseModel):
    eye_contact_percent: float
    movement_score: float
    face_detected: bool


class FeedbackOut(BaseModel):
    session_id: str
    transcript: str
    delivery: DeliveryStats
    content: Optional[ContentFeedback] = None
    body_language: Optional[BodyLanguageStats] = None
    created_at: str


class StatsOut(BaseModel):
    total_users: int
    total_sessions_completed: int
