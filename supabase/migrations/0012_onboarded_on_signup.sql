-- =============================================================
-- SB-2 — 0012 mark metadata sign-ups as onboarded
--
-- With the one-screen sign-up (doc/onboarding/), an email sign-up carries
-- the full profile (nickname, experience, consent) as metadata, so the
-- account is already onboarded on first sign-in — there is no separate
-- wizard to finish. Stamp onboarded_at in the same case as terms_accepted_at
-- so routing sends these users straight on (skipping the legacy wizard).
--
-- Google sign-ups can't carry app metadata through OAuth; their answers are
-- applied on return (client-side completeOnboarding), which sets onboarded_at.
-- Append-only; recreates the trigger from 0011 with onboarded_at added.
-- =============================================================

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (
    id, display_name, full_name, locale, skill_level,
    terms_accepted_at, onboarded_at, club_id
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
    case when new.raw_user_meta_data->>'terms_accepted' = 'true' then now() end,
    (select id from public.clubs where is_default limit 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
