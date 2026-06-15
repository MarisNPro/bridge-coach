-- =============================================================
-- Phase 1 — 0010 public sign-up + onboarding
--
-- Adds the data the post-auth onboarding wizard needs and the plumbing
-- for open self-registration:
--   (a) profiles: skill_level, onboarded_at, terms_accepted_at — all
--       written by the user via the existing self-update policy
--       (role/club_id stay protected; see 0001/0009).
--   (b) clubs.is_default + default-club assignment in handle_new_user(),
--       so an open-signup student lands in the pilot club immediately.
--   (c) coach invite codes: a stable per-coach code (profiles.invite_code)
--       plus two SECURITY DEFINER RPCs — coach_invite_code() (the coach
--       reads/mints their own code) and redeem_coach_code() (a student
--       self-links to a coach by code). The roster table's RLS stays
--       superadmin-only; linking happens inside the elevated RPC, which
--       re-checks the caller, so no policy is widened.
-- =============================================================

-- ---------- (a) profile onboarding columns ----------
alter table public.profiles
  add column if not exists skill_level       text,
  add column if not exists onboarded_at      timestamptz,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists invite_code        text;

-- Four self-rated tiers; nullable until set during onboarding.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_skill_level_chk') then
    alter table public.profiles
      add constraint profiles_skill_level_chk
      check (skill_level is null
             or skill_level in ('beginner','improving','intermediate','advanced'));
  end if;
end$$;

-- A coach's invite code is globally unique (when present).
create unique index if not exists profiles_invite_code_key
  on public.profiles (invite_code) where invite_code is not null;

-- ---------- (b) default club ----------
alter table public.clubs
  add column if not exists is_default boolean not null default false;

-- At most one club may be the default.
create unique index if not exists clubs_one_default
  on public.clubs (is_default) where is_default;

-- Pilot convenience: if there's exactly one club and none is flagged,
-- make it the default so new signups have somewhere to land.
update public.clubs set is_default = true
where (select count(*) from public.clubs) = 1
  and not exists (select 1 from public.clubs where is_default);

-- New users default to 'student' and are dropped into the default club.
-- skill_level is taken from signup metadata only if it's a valid tier
-- (passwordless signup normally leaves it null — set later in onboarding).
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, locale, skill_level, club_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'locale', 'lv'),
    case when new.raw_user_meta_data->>'skill_level'
              in ('beginner','improving','intermediate','advanced')
         then new.raw_user_meta_data->>'skill_level' end,
    (select id from public.clubs where is_default limit 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

-- ---------- (c) coach invite codes ----------
-- Short, human-readable code from an unambiguous alphabet (no I/O/0/1/L).
-- Loops until it finds an unused code; private so it isn't a REST endpoint.
create or replace function private.gen_invite_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where invite_code = code);
  end loop;
  return code;
end;
$$;

revoke all on function private.gen_invite_code() from public;

-- Backfill: give every existing coach/superadmin a code. Looped (not a single
-- UPDATE) so each generated code is visible to the next uniqueness check.
do $$
declare r record;
begin
  for r in
    select id from public.profiles
    where role in ('coach','superadmin') and invite_code is null
  loop
    update public.profiles set invite_code = private.gen_invite_code() where id = r.id;
  end loop;
end$$;

-- The calling coach reads their own invite code, minting one on first use.
create or replace function public.coach_invite_code()
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role;
  v_code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select role, invite_code into v_role, v_code
    from public.profiles where id = auth.uid();
  if v_role not in ('coach','superadmin') then raise exception 'forbidden'; end if;
  if v_code is null then
    v_code := private.gen_invite_code();
    update public.profiles set invite_code = v_code where id = auth.uid();
  end if;
  return v_code;
end;
$$;

-- A signed-in student self-links to a coach by code. Returns the coach's
-- display name so the UI can confirm the link. Idempotent.
create or replace function public.redeem_coach_code(p_code text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_coach uuid;
  v_name  text;
  v_role  public.app_role;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_code is null or length(btrim(p_code)) = 0 then raise exception 'invalid code'; end if;

  select id, display_name, role into v_coach, v_name, v_role
    from public.profiles
    where invite_code = upper(btrim(p_code));

  if v_coach is null or v_role not in ('coach','superadmin') then
    raise exception 'invalid code';
  end if;
  if v_coach = auth.uid() then raise exception 'cannot link to yourself'; end if;

  insert into public.coach_students (coach_id, student_id)
    values (v_coach, auth.uid())
    on conflict do nothing;

  return v_name;
end;
$$;

-- Authenticated callers only (the app calls these signed-in); anon cannot
-- probe codes. Mirrors the 0009 grant/revoke pattern.
revoke execute on function public.coach_invite_code()      from public, anon;
revoke execute on function public.redeem_coach_code(text)  from public, anon;
grant  execute on function public.coach_invite_code()      to authenticated;
grant  execute on function public.redeem_coach_code(text)  to authenticated;
