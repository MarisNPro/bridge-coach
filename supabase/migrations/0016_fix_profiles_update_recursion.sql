-- =============================================================
-- 0016 fix infinite recursion in profiles self-update policy
--
-- profiles_update_self guarded role/club_id with WITH CHECK subqueries that
-- SELECT from profiles. Those subqueries are themselves subject to the profiles
-- SELECT policy (which calls profile-reading helpers), so evaluating the check
-- re-enters the policy -> "infinite recursion detected in policy for relation
-- profiles". The net effect: EVERY self-update by a non-admin user failed —
-- the welcome flag (welcomed_at), prefs sync, and onboarding writes all errored.
--
-- Fix: read the caller's current role/club_id through SECURITY DEFINER helpers
-- that bypass RLS, so the WITH CHECK no longer re-enters the policy.
-- =============================================================

create or replace function private.my_role()
returns public.app_role
language sql security definer set search_path = public stable as $$
  select role from public.profiles where id = auth.uid()
$$;
-- Callable during policy evaluation by signed-in users (mirrors is_superadmin).
grant execute on function private.my_role() to authenticated, anon;

create or replace function private.my_club_id()
returns uuid
language sql security definer set search_path = public stable as $$
  select club_id from public.profiles where id = auth.uid()
$$;
grant execute on function private.my_club_id() to authenticated, anon;

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = private.my_role()
    and not (club_id is distinct from private.my_club_id())
  );
