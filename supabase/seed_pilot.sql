-- =============================================================
-- Phase 0 — pilot seed
-- Run in the Supabase SQL editor AFTER your pilot users have each
-- signed in once (magic link), so they exist in auth.users and the
-- signup trigger has created their profiles row.
--
-- Edit the three emails below to match the accounts you created.
-- Re-runnable: safe to run more than once.
-- =============================================================

-- 1) the pilot club (only if none exists yet)
insert into public.clubs (name)
select 'Pilot Club'
where not exists (select 1 from public.clubs);

-- 2) promote roles by email (everyone else stays 'student')
update public.profiles p set role = 'superadmin'
  from auth.users u
 where u.id = p.id and u.email = 'admin@example.com';

update public.profiles p set role = 'coach'
  from auth.users u
 where u.id = p.id and u.email = 'coach@example.com';

-- 3) link the coach to a student (roster)
insert into public.coach_students (coach_id, student_id)
select c.id, s.id
  from auth.users c, auth.users s
 where c.email = 'coach@example.com'
   and s.email = 'student@example.com'
on conflict do nothing;

-- 4) (optional) put every profile in the pilot club
update public.profiles
   set club_id = (select id from public.clubs order by created_at limit 1)
 where club_id is null;

-- sanity check
select u.email, p.role, p.display_name, p.locale
  from public.profiles p join auth.users u on u.id = p.id
 order by p.role;
