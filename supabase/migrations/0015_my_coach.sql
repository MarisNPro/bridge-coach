-- =============================================================
-- SB-5 — 0015 read the caller's linked coach
--
-- The onboarding redesign dropped the coach-code step; students now link from
-- Settings (doc/onboarding/link-coach-from-settings.md) via the existing
-- redeem_coach_code() RPC. To show "linked to X" we need to read the caller's
-- own coach_students row + the coach's name, but roster RLS is superadmin-only.
-- A narrow SECURITY DEFINER reader that only ever returns the caller's own coach
-- avoids widening that policy (mirrors the 0010 grant/revoke pattern).
-- =============================================================

create or replace function public.my_coach()
returns text
language sql security definer set search_path = public stable as $$
  select p.display_name
  from public.coach_students cs
  join public.profiles p on p.id = cs.coach_id
  where cs.student_id = auth.uid()
  order by cs.created_at
  limit 1;
$$;

revoke execute on function public.my_coach() from public, anon;
grant  execute on function public.my_coach() to authenticated;
