-- 0007: per-user display/training preferences (theme, text size, deck colour,
-- feedback depth) so a user's settings follow them across devices. Client-
-- managed JSON. The existing profiles UPDATE policy already lets a user write
-- their own row (role / club_id stay protected), so no new policy is needed.

alter table public.profiles
  add column if not exists prefs jsonb not null default '{}'::jsonb;
