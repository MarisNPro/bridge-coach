-- =============================================================
-- Phase 0 — RLS verifier  (run in the Supabase SQL editor)
--
-- Impersonates each pilot user via request.jwt.claims (the surface
-- auth.uid() reads) and asserts who can see / change what. Returns a
-- table of check -> PASS/FAIL. Creates two temp helper functions and
-- drops them at the end.
--
-- Edit the four emails to match your accounts:
--   admin    = superadmin
--   coach    = coach (linked to student1 via seed_pilot.sql)
--   student  = student linked to the coach
--   student2 = student NOT linked to anyone
-- =============================================================

-- helper: count rows visible in <q> when acting as user <uid>
create or replace function public._v_seen(uid uuid, q text) returns int
language plpgsql as $$
declare c int;
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  set local role authenticated;
  execute 'select count(*) from ' || q into c;
  reset role;
  return c;
end $$;

-- helper: returns PASS if <uid> is BLOCKED from changing their own role
create or replace function public._v_selfpromote(uid uuid) returns text
language plpgsql as $$
declare result text;
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  set local role authenticated;
  begin
    update public.profiles set role = 'superadmin' where id = uid;
    raise exception 'allowed';            -- undo the change + signal it was permitted
  exception when others then
    result := case when sqlerrm = 'allowed' then 'FAIL (allowed!)' else 'PASS' end;
  end;
  reset role;
  return result;
end $$;

with u as (
  select
    (select id from auth.users where email = 'admin@example.com')    as admin,
    (select id from auth.users where email = 'coach@example.com')    as coach,
    (select id from auth.users where email = 'student@example.com')  as s1,
    (select id from auth.users where email = 'student2@example.com') as s2
)
select check_name,
       case when got = want then 'PASS'
            else 'FAIL (got ' || got || ', want ' || want || ')' end as result
from (
  select 'student sees own profile only' as check_name, public._v_seen(s1,'public.profiles') got, 1 want from u
  union all select 'student sees own roster link',   public._v_seen(s1,'public.coach_students'), 1 from u
  union all select 'unlinked student sees no links', public._v_seen(s2,'public.coach_students'), 0 from u
  union all select 'coach sees self + 1 student',    public._v_seen(coach,'public.profiles'), 2 from u
  union all select 'coach sees own roster links',    public._v_seen(coach,'public.coach_students'), 1 from u
  union all select 'superadmin sees all profiles',   public._v_seen(admin,'public.profiles'),
            (select count(*)::int from public.profiles) from u
) t
union all
select 'student cannot self-promote',
       public._v_selfpromote((select id from auth.users where email='student@example.com'));

drop function public._v_seen(uuid, text);
drop function public._v_selfpromote(uuid);
