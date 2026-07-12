from typing import Literal
from pydantic import BaseModel


class Question(BaseModel):
    id: int
    type: Literal["behavioral", "technical"]
    text: str


class SessionOut(BaseModel):
    id: str
    user_id: str
    question_id: int
    video_path: str
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
    content: ContentFeedback
    body_language: BodyLanguageStats
    created_at: str


class StatsOut(BaseModel):
    total_users: int
    total_sessions_completed: int
