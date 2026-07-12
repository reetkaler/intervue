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
