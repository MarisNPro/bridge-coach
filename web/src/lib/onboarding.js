import { supabase } from './supabase'

// Sign-up answers can't ride through Google OAuth as metadata (unlike the email
// magic link). For the Google path we stash them here before redirecting; they
// are applied on return once a session exists. (Google is currently gated off;
// the apply-on-return wiring lands when it's enabled.)
const PENDING_KEY = 'bc_pending_onboarding'

export function stashPendingOnboarding(payload) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(payload)) } catch { /* ignore */ }
}

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

// Mark that the user has seen the one-time welcome screen (SB-3). Written via
// the self-update policy; flips the /welcome gate off so it shows only once.
export async function markWelcomed(userId) {
  const { error } = await supabase
    .from('profiles')
    .update({ welcomed_at: new Date().toISOString() })
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
