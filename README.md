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
- **Question picker** — 20 questions (behavioral + technical), grouped by
  type, instead of a hardcoded single question.
- **Coding problems** — a Monaco-based code editor against 5 classic
  problems (Two Sum, Valid Parentheses, Reverse Linked List, Binary Search,
  FizzBuzz), graded via Judge0's sandboxed execution API (RapidAPI) rather
  than running arbitrary user code ourselves.
- **Recorded coding narration** — an alternate mode where you narrate your
  approach on camera (audio-only recording) while solving a coding
  problem, and get feedback that combines your verbal explanation with
  whether your code actually passed the test cases.
- **Anonymous sign-in captcha** — Cloudflare Turnstile gates every
  `signInAnonymously()` call, closing off the unlimited-free-accounts
  bypass around the per-user quotas below. Verified server-side by
  Supabase (confirmed by testing that invalid/missing tokens are actually
  rejected with `captcha_failed`, not silently accepted).

Cost/abuse guards throughout: a 3-minute recording cap and 15/day quota on
interview sessions, a 10/day quota on plain code submissions, a separate
5/day quota on the (more expensive) recorded-narration flow, and an
idempotency guard everywhere so retries can't double-bill a paid API call.
Judge0's own sandboxing enforces CPU/time limits, so submitted code (even
an infinite loop) can't run indefinitely or cost more than a flat
per-submission rate.

Not yet built: general styling/UX polish (still plain Tailwind defaults)
and actual deployment (everything below currently only runs locally).

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
cp .env.example .env         # fill in Supabase + OpenAI + Anthropic + Judge0 keys
.venv/bin/uvicorn app.main:app --reload   # http://localhost:8000
```

Judge0 key: sign up for the Judge0 CE API on RapidAPI
(rapidapi.com/judge0-official/api/judge0-ce), subscribe to the free/Basic
plan, and use the `X-RapidAPI-Key` as `JUDGE0_API_KEY`.

### Supabase

1. Create a project at supabase.com.
2. Run `supabase_schema.sql` in the SQL editor (creates `sessions`,
   `feedback`, `coding_sessions`, `coding_feedback`, RLS policies, and the
   private `recordings` storage bucket).
3. Enable anonymous sign-ins under Authentication → Providers.

## Notes

- Backend uses Python 3.11 (via Homebrew) rather than the system Python 3.9
  for better MediaPipe/FastAPI compatibility.
- MediaPipe model assets (`.task`/`.tflite` files) are vendored in
  `backend/app/assets/` and `frontend/public/models/` rather than fetched
  at runtime, so builds don't depend on Google's model storage being
  reachable.
