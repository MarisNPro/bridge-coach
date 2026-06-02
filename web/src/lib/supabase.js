import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fail loud in dev rather than silently 401-ing later.
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. See .env.example')
}

export const supabase = createClient(url, anonKey)
