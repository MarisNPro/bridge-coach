import { supabase } from './supabase'

// The calling coach's students with aggregated progress (server-side RPC,
// scoped to the coach by auth.uid()).
export async function fetchRoster() {
  const { data, error } = await supabase.rpc('coach_roster')
  if (error) throw error
  return data || []
}

// Recent attempts for one student. The attempts RLS already authorises a
// coach to read their linked students' rows, so a direct query is enough.
export async function fetchStudentAttempts(studentId, limit = 25) {
  const { data, error } = await supabase
    .from('attempts')
    .select('deal_id, your_call, expected_call, conformant, created_at')
    .eq('user_id', studentId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}
