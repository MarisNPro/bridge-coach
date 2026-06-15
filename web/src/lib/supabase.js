import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fail loud in dev rather than silently 401-ing later.
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. See .env.example')
}

// Fall back to placeholders when env is absent (e.g. the test runner) so merely
// importing this module never throws — real calls still need the real env.
export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'anon-key')
