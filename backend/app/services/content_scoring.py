from anthropic import Anthropic

from app.config import settings
from app.models.schemas import ContentFeedback

client = Anthropic(api_key=settings.anthropic_api_key)

SYSTEM_PROMPT = (
    "You are an interview coach scoring a candidate's spoken answer. "
    "Score content quality only — not delivery or body language. "
    "Give `score` as an integer from 1 (poor) to 10 (excellent). "
    "Be specific: reference details from the transcript in strengths and improvements."
)


def score_content(question_text: str, transcript: str) -> ContentFeedback:
    response = client.messages.parse(
        model="claude-sonnet-5",
        max_tokens=1024,
        output_config={"effort": "low"},
        output_format=ContentFeedback,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Interview question: {question_text}\n\nCandidate's answer (transcribed): {transcript}",
            }
        ],
    )

    if response.parsed_output is None:
        raise ValueError("Claude did not return a parseable ContentFeedback response")

    return response.parsed_output
