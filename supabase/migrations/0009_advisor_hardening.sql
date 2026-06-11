-- 0009: address Supabase advisors (post-0007).
-- (a) SECURITY — stop unauthenticated (public/anon) execution of the admin/coach/
--     student RPCs. They already self-authorise (admin_* check is_superadmin;
--     coach_* gate on coaches_student; student_assignments scopes to auth.uid()),
--     but `anon` should not be able to invoke them at all. Authenticated callers
--     keep access (the app calls them signed-in). Clears lint 0028.
-- (b) PERFORMANCE — wrap auth.uid() in (select auth.uid()) inside RLS policies so
--     it's evaluated once per query, not once per row (lint 0003). Same logic.
--     (The 0029 "authenticated can execute SECURITY DEFINER" notices are by design
--     here — these RPCs must run elevated and re-check authorisation internally.)

-- (a) RPC execute grants ------------------------------------------------------
revoke execute on function public.admin_link(uuid, uuid)     from public, anon;
revoke execute on function public.admin_links()              from public, anon;
revoke execute on function public.admin_set_role(uuid, text) from public, anon;
revoke execute on function public.admin_unlink(uuid, uuid)   from public, anon;
revoke execute on function public.admin_users()              from public, anon;
revoke execute on function public.coach_assignments()        from public, anon;
revoke execute on function public.coach_roster()             from public, anon;
revoke execute on function public.student_assignments()      from public, anon;

grant execute on function public.admin_link(uuid, uuid)     to authenticated;
grant execute on function public.admin_links()              to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_unlink(uuid, uuid)   to authenticated;
grant execute on function public.admin_users()              to authenticated;
grant execute on function public.coach_assignments()        to authenticated;
grant execute on function public.coach_roster()             to authenticated;
grant execute on function public.student_assignments()      to authenticated;

-- (b) RLS policies: cache auth.uid() ------------------------------------------
alter policy profiles_select on public.profiles
  using ((id = (select auth.uid())) or private.coaches_student(id) or private.is_superadmin());

alter policy profiles_update_self on public.profiles
  using (id = (select auth.uid()))
  with check ((id = (select auth.uid()))
    and (role = (select p.role from public.profiles p where p.id = (select auth.uid())))
    and (not (club_id is distinct from (select p.club_id from public.profiles p where p.id = (select auth.uid())))));

alter policy clubs_select on public.clubs
  using ((select auth.uid()) is not null);

alter policy cs_select on public.coach_students
  using ((coach_id = (select auth.uid())) or (student_id = (select auth.uid())) or private.is_superadmin());

alter policy attempts_select on public.attempts
  using ((user_id = (select auth.uid())) or private.coaches_student(user_id) or private.is_superadmin());

alter policy attempts_insert on public.attempts
  with check (user_id = (select auth.uid()));

alter policy assignments_select on public.assignments
  using ((coach_id = (select auth.uid())) or (student_id = (select auth.uid())) or private.is_superadmin());

alter policy assignments_insert on public.assignments
  with check ((coach_id = (select auth.uid())) and private.coaches_student(student_id));

alter policy assignments_delete on public.assignments
  using ((coach_id = (select auth.uid())) or private.is_superadmin());
