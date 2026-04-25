import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const hasSupabaseEnv = Boolean(supabaseUrl && supabasePublishableKey)
export const vercelEnv = import.meta.env.VITE_VERCEL_ENV ?? 'development'

export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null
