from openai import OpenAI

from app.config import settings

client = OpenAI(api_key=settings.openai_api_key)


def transcribe(video_bytes: bytes, filename: str) -> str:
    result = client.audio.transcriptions.create(
        model="whisper-1",
        file=(filename, video_bytes),
        language="en",
    )
    return result.text
