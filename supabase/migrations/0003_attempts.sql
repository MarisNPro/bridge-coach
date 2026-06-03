-- =============================================================
-- Phase 1 — 0003 practice attempts
-- Append-only log of bidding-practice attempts (one row per graded call).
-- RLS: a user reads/writes only their own rows; a coach reads their linked
-- students' rows; a superadmin reads all. Reuses the private.* helpers
-- introduced in 0002 (kept out of the API-exposed schema).
-- =============================================================

create table if not exists public.attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id       text not null,
  hand          text not null,
  auction       jsonb not null default '[]'::jsonb,
  seat          text,
  system_id     text not null default 'natural-v1',
  your_call     text not null,
  expected_call text,
  conformant    boolean not null,
  situation_id  text,
  created_at    timestamptz not null default now()
);

create index if not exists attempts_user_created_idx
  on public.attempts (user_id, created_at desc);

alter table public.attempts enable row level security;

-- Read: own rows, or rows of a student you coach, or anything if superadmin.
drop policy if exists attempts_select on public.attempts;
create policy attempts_select on public.attempts
  for select using (
    user_id = auth.uid()
    or private.coaches_student(user_id)
    or private.is_superadmin()
  );

-- Write: you may insert only rows attributed to yourself.
drop policy if exists attempts_insert on public.attempts;
create policy attempts_insert on public.attempts
  for insert with check (user_id = auth.uid());

grant select, insert on public.attempts to authenticated;
