import { supabase } from './supabase'

// Persist the onboarding answers to the user's own profile row. The self-update
// RLS policy allows these columns (role/club_id stay protected); setting
// onboarded_at is what flips needsOnboarding off. terms_accepted_at records
// consent at completion time.
export async function completeOnboarding(userId, { displayName, locale, skillLevel }) {
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName?.trim() || null,
      locale,
      skill_level: skillLevel,
      terms_accepted_at: new Date().toISOString(),
      onboarded_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) throw error
}

// Link the signed-in student to a coach by their invite code. Server-side
// SECURITY DEFINER RPC (migration 0010); returns the coach's display name on
// success, or throws 'invalid code' / 'cannot link to yourself'.
export async function redeemCoachCode(code) {
  const { data, error } = await supabase.rpc('redeem_coach_code', { p_code: code })
  if (error) throw error
  return data // coach display name
}
