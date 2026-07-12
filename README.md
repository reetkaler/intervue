# Intervue

Practice interview responses on camera and get AI-generated feedback on
content quality, delivery, and body language.

## Status

Repo scaffold only. Recording, transcription, scoring, and body-language
analysis are not implemented yet — see the `app/routers/*.py` docstrings
in the backend for what's stubbed vs. live.

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

- `backend/requirements.txt` is intentionally minimal right now; the Whisper,
  Claude, and MediaPipe dependencies are commented in and added when those
  pipeline phases are built.
- Backend uses Python 3.11 (via Homebrew) rather than the system Python 3.9
  for better MediaPipe/FastAPI compatibility.
