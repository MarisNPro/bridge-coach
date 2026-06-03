import { supabase } from './supabase'

// Record one graded attempt. user_id is omitted on purpose: the table
// defaults it to auth.uid() and RLS enforces it, so the client can't attribute
// a row to anyone else. Caller treats this as fire-and-forget.
export async function recordAttempt(a) {
  const { error } = await supabase.from('attempts').insert({
    deal_id: a.deal_id,
    hand: a.hand,
    auction: a.auction,
    seat: a.seat,
    system_id: a.system_id || 'natural-v1',
    your_call: a.your_call,
    expected_call: a.expected_call ?? null,
    conformant: a.conformant,
    situation_id: a.situation_id ?? null,
  })
  if (error) throw error
}

// Lifetime totals for the signed-in user (RLS scopes the counts to own rows).
export async function fetchStats() {
  const total = await supabase.from('attempts').select('*', { count: 'exact', head: true })
  if (total.error) throw total.error
  const solved = await supabase.from('attempts').select('*', { count: 'exact', head: true }).eq('conformant', true)
  if (solved.error) throw solved.error
  return { total: total.count || 0, solved: solved.count || 0 }
}
