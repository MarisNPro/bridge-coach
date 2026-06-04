import { supabase } from './supabase'

// Student: assignments addressed to me, with progress (RLS-scoped RPC).
export async function fetchStudentAssignments() {
  const { data, error } = await supabase.rpc('student_assignments')
  if (error) throw error
  return data || []
}

// Coach: assignments I created, with student name + progress.
export async function fetchCoachAssignments() {
  const { data, error } = await supabase.rpc('coach_assignments')
  if (error) throw error
  return data || []
}

// Coach: create an assignment. coach_id defaults to auth.uid(); RLS enforces
// that the caller actually coaches the student.
export async function createAssignment({ student_id, situation, target }) {
  const { error } = await supabase.from('assignments').insert({ student_id, situation, target })
  if (error) throw error
}

export async function deleteAssignment(id) {
  const { error } = await supabase.from('assignments').delete().eq('id', id)
  if (error) throw error
}
