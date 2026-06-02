-- =============================================================
-- Phase 0 — 0002 hardening
-- Move SECURITY DEFINER helper functions out of the API-exposed
-- `public` schema into `private`, so PostgREST does not expose them
-- as REST RPC endpoints (Supabase security-advisor lints 0028/0029).
-- They must stay SECURITY DEFINER (prevents RLS recursion), so the
-- correct fix is relocation, not SECURITY INVOKER.
--
-- RLS policies are repointed to private.*. Verified: all role-based
-- visibility checks still pass after this change.
-- =============================================================

create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.current_app_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function private.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.current_app_role() = 'superadmin', false);
$$;

create or replace function private.coaches_student(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.coach_students
    where coach_id = auth.uid() and student_id = target
  );
$$;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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
  for each row execute function private.handle_new_user();

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or private.coaches_student(id)
    or private.is_superadmin()
  );

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (private.is_superadmin()) with check (private.is_superadmin());

drop policy if exists clubs_admin_write on public.clubs;
create policy clubs_admin_write on public.clubs
  for all using (private.is_superadmin()) with check (private.is_superadmin());

drop policy if exists cs_select on public.coach_students;
create policy cs_select on public.coach_students
  for select using (
    coach_id = auth.uid()
    or student_id = auth.uid()
    or private.is_superadmin()
  );

drop policy if exists cs_admin_write on public.coach_students;
create policy cs_admin_write on public.coach_students
  for all using (private.is_superadmin()) with check (private.is_superadmin());

drop function if exists public.is_superadmin();
drop function if exists public.current_app_role();
drop function if exists public.coaches_student(uuid);
drop function if exists public.handle_new_user();

grant execute on function private.current_app_role(),
  private.is_superadmin(), private.coaches_student(uuid) to anon, authenticated;
revoke all on function private.handle_new_user() from public;
