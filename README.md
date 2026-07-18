# Intervue

Practice interview responses on camera and get AI-generated feedback on
content quality, delivery, and body language.

## Status

Core pipeline is fully built and working end-to-end:

- **Recording + upload** — browser records via MediaRecorder, uploads
  directly to Supabase Storage, with live face-detection and noise-level
  indicators shown while recording.
- **Transcription** — OpenAI Whisper, with hallucination detection
  (`no_speech_prob`/`avg_logprob`/`compression_ratio`) and word-count-based
  delivery stats (words/min, filler word count).
- **Content scoring** — Claude Sonnet 5 scores the transcript against the
  interview question (structured JSON output).
- **Body-language analysis** — MediaPipe FaceLandmarker (eye contact,
  expression) and HandLandmarker (gesture activity).

Cost/abuse guards throughout: a 3-minute recording cap, a 15
sessions/user/day quota, and an idempotency guard so retries can't
double-bill a recording against the paid Whisper/Claude APIs.

Not yet built: question-selection UI (hardcoded to question 1) and general
styling/UX polish.

## Structure

```
frontend/   Next.js (App Router, TypeScript, Tailwind) — hosted on Vercel
backend/    FastAPI (Python) — hosted on Render/Railway
supabase_schema.sql   Postgres schema + RLS policies + storage bucket setup
```

## Local setup

### Frontend

```
cd frontend
cp .env.example .env.local   # fill in Supabase URL/anon key
npm install
npm run dev                  # http://localhost:3000
```

### Backend

```
cd backend
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env         # fill in Supabase + OpenAI + Anthropic keys
.venv/bin/uvicorn app.main:app --reload   # http://localhost:8000
```

### Supabase

1. Create a project at supabase.com.
2. Run `supabase_schema.sql` in the SQL editor (creates `sessions`,
   `feedback`, RLS policies, and the private `recordings` storage bucket).
3. Enable anonymous sign-ins under Authentication → Providers.

## Notes

- Backend uses Python 3.11 (via Homebrew) rather than the system Python 3.9
  for better MediaPipe/FastAPI compatibility.
- MediaPipe model assets (`.task`/`.tflite` files) are vendored in
  `backend/app/assets/` and `frontend/public/models/` rather than fetched
  at runtime, so builds don't depend on Google's model storage being
  reachable.
