import re

from app.models.schemas import DeliveryStats

FILLER_WORDS = ["um", "uh", "like", "you know", "sort of", "kind of", "basically", "literally"]
FILLER_PATTERN = re.compile(r"\b(" + "|".join(FILLER_WORDS) + r")\b", re.IGNORECASE)


def compute_delivery_stats(transcript: str, duration_seconds: int) -> DeliveryStats:
    word_count = len(transcript.split())
    words_per_minute = word_count / (duration_seconds / 60) if duration_seconds else 0.0
    filler_word_count = len(FILLER_PATTERN.findall(transcript))

    return DeliveryStats(
        words_per_minute=round(words_per_minute, 1),
        filler_word_count=filler_word_count,
    )
