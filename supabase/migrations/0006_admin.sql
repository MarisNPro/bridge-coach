-- =============================================================
-- Phase 1 — 0006 admin (superadmin user management)
-- SECURITY DEFINER RPCs, each guarded by private.is_superadmin(). These let
-- the superadmin list users, change a role, and manage coach<->student links
-- from the UI instead of raw SQL. No table RLS is widened — access is gated
-- inside each function, so a non-superadmin caller simply gets 'forbidden'.
-- =============================================================

create or replace function public.admin_users()
returns table (id uuid, email text, display_name text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_superadmin() then raise exception 'forbidden'; end if;
  return query
    select u.id, u.email::text, p.display_name, p.role::text, u.created_at
    from auth.users u
    join public.profiles p on p.id = u.id
    order by u.created_at;
end $$;

create or replace function public.admin_set_role(target uuid, new_role text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_superadmin() then raise exception 'forbidden'; end if;
  if new_role not in ('superadmin','coach','student') then raise exception 'invalid role'; end if;
  if target = auth.uid() and new_role <> 'superadmin' then raise exception 'cannot change your own admin role'; end if;
  update public.profiles set role = new_role::app_role where id = target;
end $$;

create or replace function public.admin_links()
returns table (coach_id uuid, coach_name text, student_id uuid, student_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_superadmin() then raise exception 'forbidden'; end if;
  return query
    select cs.coach_id, pc.display_name, cs.student_id, ps.display_name
    from public.coach_students cs
    join public.profiles pc on pc.id = cs.coach_id
    join public.profiles ps on ps.id = cs.student_id
    order by pc.display_name nulls last, ps.display_name nulls last;
end $$;

create or replace function public.admin_link(p_coach uuid, p_student uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_superadmin() then raise exception 'forbidden'; end if;
  if p_coach = p_student then raise exception 'coach and student must differ'; end if;
  insert into public.coach_students (coach_id, student_id)
    values (p_coach, p_student) on conflict do nothing;
end $$;

create or replace function public.admin_unlink(p_coach uuid, p_student uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_superadmin() then raise exception 'forbidden'; end if;
  delete from public.coach_students where coach_id = p_coach and student_id = p_student;
end $$;

grant execute on function public.admin_users()                 to authenticated;
grant execute on function public.admin_set_role(uuid, text)    to authenticated;
grant execute on function public.admin_links()                 to authenticated;
grant execute on function public.admin_link(uuid, uuid)        to authenticated;
grant execute on function public.admin_unlink(uuid, uuid)      to authenticated;
