-- =============================================================
-- SB-3 — 0013 welcome-screen flag
--
-- After onboarding, a new user sees a one-time welcome screen. Track that with
-- profiles.welcomed_at (written by the user via the existing self-update policy;
-- role/club_id stay protected). Existing onboarded users are backfilled as
-- already-welcomed so the screen never appears retroactively.
-- =============================================================

alter table public.profiles
  add column if not exists welcomed_at timestamptz;

-- Don't show the welcome screen to users who already onboarded before this shipped.
update public.profiles
  set welcomed_at = coalesce(onboarded_at, now())
  where onboarded_at is not null and welcomed_at is null;
