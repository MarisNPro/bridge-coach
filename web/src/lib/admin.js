import { supabase } from './supabase'

export async function fetchUsers() {
  const { data, error } = await supabase.rpc('admin_users')
  if (error) throw error
  return data || []
}

export async function setRole(target, role) {
  const { error } = await supabase.rpc('admin_set_role', { target, new_role: role })
  if (error) throw error
}

export async function fetchLinks() {
  const { data, error } = await supabase.rpc('admin_links')
  if (error) throw error
  return data || []
}

export async function linkCoachStudent(coach, student) {
  const { error } = await supabase.rpc('admin_link', { p_coach: coach, p_student: student })
  if (error) throw error
}

export async function unlinkCoachStudent(coach, student) {
  const { error } = await supabase.rpc('admin_unlink', { p_coach: coach, p_student: student })
  if (error) throw error
}
