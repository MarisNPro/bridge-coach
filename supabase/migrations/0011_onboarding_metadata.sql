-- =============================================================
-- SB-1 — 0011 pre-auth onboarding metadata
--
-- The onboarding redesign (doc/onboarding/) collects the profile details
-- BEFORE authentication and carries them as sign-up metadata, so the
-- handle_new_user() trigger writes a fully-populated profile on first
-- sign-in. This migration:
--   (a) adds profiles.full_name (the real name captured from Google;
--       the public nickname stays display_name);
--   (b) extends handle_new_user() to read full_name and to stamp
--       terms_accepted_at when the metadata carries consent.
-- Append-only and idempotent (mirrors 0010); RLS is unchanged — role and
-- club_id remain non-user-writable.
-- =============================================================

-- ---------- (a) real-name column ----------
alter table public.profiles
  add column if not exists full_name text;

-- ---------- (b) trigger reads the new metadata ----------
-- display_name (nickname) and skill_level were already read in 0010. We now
-- also take full_name (Google's 'full_name' or 'name') and stamp
-- terms_accepted_at when raw_user_meta_data carries terms_accepted = true.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (
    id, display_name, full_name, locale, skill_level, terms_accepted_at, club_id
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'locale', 'lv'),
    case when new.raw_user_meta_data->>'skill_level'
              in ('beginner','improving','intermediate','advanced')
         then new.raw_user_meta_data->>'skill_level' end,
    case when new.raw_user_meta_data->>'terms_accepted' = 'true' then now() end,
    (select id from public.clubs where is_default limit 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
