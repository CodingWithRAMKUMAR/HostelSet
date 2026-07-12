import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !anonKey) throw new Error('Missing public Supabase configuration')

export const publicSupabase = createClient(url, anonKey, {
  auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
})
