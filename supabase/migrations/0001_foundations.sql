-- =============================================================
-- Phase 0 — Foundations
-- Bridge Coaching Platform · MVP
--
-- Creates: clubs, profiles (extends auth.users), coach_students.
-- Flat role model (one role per user). Single pilot club.
-- Includes: auto-profile-on-signup trigger + RLS policies.
--
-- Run this once against your Supabase project (SQL editor or CLI).
-- It is idempotent enough to re-run during early dev, but treat it
-- as the first real migration — later phases add to it, never edit it.
-- =============================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- Role enum (flat model) ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('superadmin', 'coach', 'student');
  end if;
end$$;

-- ---------- clubs ----------
-- One row for the pilot club. Kept as a table for multi-club later.
create table if not exists public.clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- profiles ----------
-- Extends Supabase auth.users 1:1. role/display_name/locale/club_id.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          public.app_role not null default 'student',
  display_name  text,
  locale        text not null default 'lv',          -- 'lv' | 'en'
  club_id       uuid references public.clubs(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ---------- coach_students ----------
-- Roster link. A coach is responsible for a set of students.
create table if not exists public.coach_students (
  coach_id    uuid not null references public.profiles(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (coach_id, student_id)
);

create index if not exists idx_coach_students_student on public.coach_students(student_id);

-- =============================================================
-- Auto-create a profile when a new auth user signs up.
-- New users default to 'student'; superadmin promotes coaches.
-- display_name / locale are pulled from signup metadata if present.
-- =============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'locale', 'lv')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- Role helpers (SECURITY DEFINER to avoid RLS recursion).
-- Reading profiles from inside a profiles policy would recurse;
-- these functions bypass RLS to answer "what is the caller?".
-- =============================================================
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'superadmin', false);
$$;

-- True if the caller (a coach) is linked to the given student.
create or replace function public.coaches_student(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coach_students
    where coach_id = auth.uid() and student_id = target
  );
$$;

-- =============================================================
-- Row-Level Security
-- =============================================================
alter table public.clubs           enable row level security;
alter table public.profiles        enable row level security;
alter table public.coach_students  enable row level security;

-- ---- profiles ----
-- Read: own row, OR a coach reading their students, OR superadmin.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or public.coaches_student(id)
    or public.is_superadmin()
  );

-- Update: own row (but NOT your own role/club — enforced below),
-- OR superadmin (full).
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role    = (select role    from public.profiles where id = auth.uid())
    and club_id is not distinct from (select club_id from public.profiles where id = auth.uid())
  );

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_superadmin()) with check (public.is_superadmin());

-- Inserts happen via the signup trigger (SECURITY DEFINER), so no
-- public insert policy is needed for normal flow.

-- ---- clubs ----
-- Any authenticated user may read clubs; only superadmin writes.
drop policy if exists clubs_select on public.clubs;
create policy clubs_select on public.clubs
  for select using (auth.uid() is not null);

drop policy if exists clubs_admin_write on public.clubs;
create policy clubs_admin_write on public.clubs
  for all using (public.is_superadmin()) with check (public.is_superadmin());

-- ---- coach_students ----
-- Read: the coach on the link, the student on the link, or superadmin.
drop policy if exists cs_select on public.coach_students;
create policy cs_select on public.coach_students
  for select using (
    coach_id = auth.uid()
    or student_id = auth.uid()
    or public.is_superadmin()
  );

-- Write: superadmin only for the pilot (keeps roster authoritative).
drop policy if exists cs_admin_write on public.coach_students;
create policy cs_admin_write on public.coach_students
  for all using (public.is_superadmin()) with check (public.is_superadmin());

-- =============================================================
-- Pilot seed (optional — uncomment and set your own user id).
-- After you sign up once, find your id in auth.users and promote
-- yourself to superadmin so you can manage everyone else.
-- =============================================================
-- insert into public.clubs (name) values ('Pilot Club');
-- update public.profiles set role = 'superadmin'
--   where id = '<YOUR-AUTH-USER-UUID>';
