import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

console.info('[Supabase Boot] VITE_SUPABASE_URL exists:', Boolean(supabaseUrl))
console.info('[Supabase Boot] VITE_SUPABASE_PUBLISHABLE_KEY exists:', Boolean(supabaseKey))

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null
