from openai import OpenAI

from app.config import settings

client = OpenAI(api_key=settings.openai_api_key)

# Whisper hallucination heuristics: a segment is unreliable if avg_logprob is
# below -1 or compression_ratio is above 2.4 (repetitive looping text) — from
# OpenAI's own guidance. no_speech_prob is checked independently: some
# hallucinated phrases (e.g. "Thank you for watching!") are common enough in
# Whisper's training data that it produces them *confidently*, so logprob/
# compression alone can miss them — no_speech_prob catches those since it's
# the model's own estimate that the segment had no real speech, regardless of
# how confident the (wrong) words it output looked.
_AVG_LOGPROB_THRESHOLD = -1.0
_COMPRESSION_RATIO_THRESHOLD = 2.4
_NO_SPEECH_PROB_THRESHOLD = 0.5


def transcribe(video_bytes: bytes, filename: str) -> str:
    result = client.audio.transcriptions.create(
        model="whisper-1",
        file=(filename, video_bytes),
        language="en",
        response_format="verbose_json",
    )

    if result.segments and all(
        seg.avg_logprob < _AVG_LOGPROB_THRESHOLD
        or seg.compression_ratio > _COMPRESSION_RATIO_THRESHOLD
        or seg.no_speech_prob > _NO_SPEECH_PROB_THRESHOLD
        for seg in result.segments
    ):
        raise ValueError(
            "Couldn't detect clear speech in the recording — the audio may have been "
            "too quiet or the room too noisy. Please try again: speak a bit louder, "
            "move closer to the mic, or find a quieter spot."
        )

    return result.text
