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
    face_detected: bool
    eye_contact_percent: float
    positive_expression_percent: float
    hands_visible_percent: float
    gesture_activity_score: float


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


class CodingProblem(BaseModel):
    id: int
    title: str
    description: str
    starter_code: str


class CodeSubmission(BaseModel):
    code: str


class TestCaseResult(BaseModel):
    call: str
    passed: bool
    status: str
    stdout: str
    stderr: str


class SubmissionResult(BaseModel):
    all_passed: bool
    test_results: list[TestCaseResult]


class CodingSessionCreate(BaseModel):
    problem_id: int
    audio_path: str
    duration_seconds: int
    code: str


class CodingSessionOut(BaseModel):
    id: str
    user_id: str
    problem_id: int
    audio_path: str
    duration_seconds: int
    code: str
    status: Literal["pending", "processing", "complete", "failed"]
    created_at: str


class CodingFeedback(BaseModel):
    score: int
    strengths: list[str]
    improvements: list[str]
    summary: str


class CodingFeedbackOut(BaseModel):
    coding_session_id: str
    transcript: str
    test_results: SubmissionResult
    score_feedback: CodingFeedback
    created_at: str
