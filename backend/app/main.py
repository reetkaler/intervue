from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import coding, coding_sessions, feedback, questions, sessions, stats

app = FastAPI(title="Intervue API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(questions.router)
app.include_router(sessions.router)
app.include_router(feedback.router)
app.include_router(stats.router)
app.include_router(coding.router)
app.include_router(coding_sessions.router)


@app.get("/health")
def health():
    return {"status": "ok"}
