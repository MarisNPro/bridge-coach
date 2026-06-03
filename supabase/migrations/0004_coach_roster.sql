-- =============================================================
-- Phase 1 — 0004 coach roster
-- coach_roster(): for the calling coach, returns each linked student with
-- their attempt totals. SECURITY DEFINER so it can aggregate across profiles
-- and attempts in one pass, but it is hard-scoped to the caller's own
-- students via `cs.coach_id = auth.uid()` — a coach can never see another
-- coach's roster. Per-student attempt detail is read client-side, where the
-- attempts RLS (private.coaches_student) already authorises coach access.
-- =============================================================

create or replace function public.coach_roster()
returns table (
  student_id   uuid,
  display_name text,
  total        bigint,
  solved       bigint,
  last_attempt timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    count(a.id)                                  as total,
    count(a.id) filter (where a.conformant)      as solved,
    max(a.created_at)                            as last_attempt
  from public.coach_students cs
  join public.profiles p          on p.id = cs.student_id
  left join public.attempts a     on a.user_id = cs.student_id
  where cs.coach_id = auth.uid()
  group by p.id, p.display_name
  order by p.display_name nulls last;
$$;

grant execute on function public.coach_roster() to authenticated;
