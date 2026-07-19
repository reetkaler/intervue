-- Intervue Supabase schema
-- Run in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- sessions: one row per recorded interview attempt
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id int not null,
  video_path text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'complete', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_id_idx on sessions (user_id);

-- feedback: one row per completed analysis, 1:1 with sessions
create table if not exists feedback (
  session_id uuid primary key references sessions (id) on delete cascade,
  transcript text not null default '',
  delivery jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  body_language jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Row Level Security: users can only read/write their own sessions and feedback.
alter table sessions enable row level security;
alter table feedback enable row level security;

create policy "Users can view their own sessions"
  on sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own sessions"
  on sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can view feedback for their own sessions"
  on feedback for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = feedback.session_id
        and sessions.user_id = auth.uid()
    )
  );

-- Storage: private bucket for recorded video, one object per session.
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

create policy "Users can upload their own recordings"
  on storage.objects for insert
  with check (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can read their own recordings"
  on storage.objects for select
  using (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Phase 1/2 addition: cap recording length (bounds Whisper transcription
-- cost per session) and enforce a storage bucket size ceiling as a backstop.
alter table sessions
  add column duration_seconds int not null
  check (duration_seconds > 0 and duration_seconds <= 180);

update storage.buckets set file_size_limit = 104857600 where id = 'recordings';

-- Coding-narration feature: record yourself explaining a coding-problem
-- solution while solving it. Audio-only (no video path/body-language here),
-- reuses the same private `recordings` bucket + per-user-folder policies.
create table if not exists coding_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  problem_id int not null,
  audio_path text not null,
  duration_seconds int not null check (duration_seconds > 0 and duration_seconds <= 360),
  code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'complete', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists coding_sessions_user_id_idx on coding_sessions (user_id);

create table if not exists coding_feedback (
  coding_session_id uuid primary key references coding_sessions (id) on delete cascade,
  transcript text not null default '',
  test_results jsonb not null default '{}'::jsonb,
  score_feedback jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table coding_sessions enable row level security;
alter table coding_feedback enable row level security;

create policy "Users can view their own coding sessions"
  on coding_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own coding sessions"
  on coding_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can view feedback for their own coding sessions"
  on coding_feedback for select
  using (
    exists (
      select 1 from coding_sessions
      where coding_sessions.id = coding_feedback.coding_session_id
        and coding_sessions.user_id = auth.uid()
    )
  );
