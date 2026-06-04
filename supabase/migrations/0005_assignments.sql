-- =============================================================
-- Phase 1 — 0005 assignments
-- A coach assigns a practice situation + target to a student. Progress is
-- derived from attempts the student logs in that situation on/after the
-- assignment date (attempts.deal_id stores the engine situation_id).
-- RLS: a coach manages assignments they created and may only assign to their
-- own students; a student may read assignments addressed to them; superadmin
-- sees all. Progress RPCs are SECURITY DEFINER, hard-scoped by auth.uid().
-- =============================================================

create table if not exists public.assignments (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id  uuid not null references auth.users(id) on delete cascade,
  situation   text not null,
  target      int  not null default 10 check (target between 1 and 100),
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists assignments_student_idx on public.assignments (student_id);
create index if not exists assignments_coach_idx   on public.assignments (coach_id);

alter table public.assignments enable row level security;

drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments for select using (
  coach_id = auth.uid() or student_id = auth.uid() or private.is_superadmin()
);

-- A coach can only create assignments for students they actually coach.
drop policy if exists assignments_insert on public.assignments;
create policy assignments_insert on public.assignments for insert with check (
  coach_id = auth.uid() and private.coaches_student(student_id)
);

drop policy if exists assignments_delete on public.assignments;
create policy assignments_delete on public.assignments for delete using (
  coach_id = auth.uid() or private.is_superadmin()
);

grant select, insert, delete on public.assignments to authenticated;

-- Coach view: assignments they created, with student name + progress.
create or replace function public.coach_assignments()
returns table (
  id uuid, student_id uuid, student_name text, situation text,
  target int, done bigint, solved bigint, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select a.id, a.student_id, p.display_name, a.situation, a.target,
         count(at.id)                              as done,
         count(at.id) filter (where at.conformant) as solved,
         a.created_at
  from public.assignments a
  join public.profiles p on p.id = a.student_id
  left join public.attempts at
         on at.user_id = a.student_id
        and at.deal_id = a.situation
        and at.created_at >= a.created_at
  where a.coach_id = auth.uid()
  group by a.id, a.student_id, p.display_name, a.situation, a.target, a.created_at
  order by a.created_at desc;
$$;
grant execute on function public.coach_assignments() to authenticated;

-- Student view: assignments addressed to them, with progress.
create or replace function public.student_assignments()
returns table (
  id uuid, situation text, target int, done bigint, solved bigint, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select a.id, a.situation, a.target,
         count(at.id)                              as done,
         count(at.id) filter (where at.conformant) as solved,
         a.created_at
  from public.assignments a
  left join public.attempts at
         on at.user_id = a.student_id
        and at.deal_id = a.situation
        and at.created_at >= a.created_at
  where a.student_id = auth.uid()
  group by a.id, a.situation, a.target, a.created_at
  order by a.created_at desc;
$$;
grant execute on function public.student_assignments() to authenticated;
