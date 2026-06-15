-- =============================================================
-- SB-4 — 0014 backfill legacy profiles as onboarded + welcomed
--
-- The post-auth onboarding wizard is being retired: onboarding is now captured
-- at sign-up (0011/0012) and the welcome screen handles first entry (0013).
-- Any pre-existing profile that never went through the old wizard would have
-- null onboarded_at/welcomed_at and, with the wizard gone, nowhere to land.
-- Treat existing accounts as already onboarded + welcomed.
-- =============================================================

update public.profiles
set onboarded_at = coalesce(onboarded_at, created_at),
    welcomed_at  = coalesce(welcomed_at,  created_at)
where onboarded_at is null or welcomed_at is null;
