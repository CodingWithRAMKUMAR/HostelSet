import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yzfggwnkawicwlniflnn.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6Zmdnd25rYXdpY3dsbmlmbG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzQxNjYsImV4cCI6MjA5NTYxMDE2Nn0.FGm5Xo35eM2Ms-fNKnTtmop1W_55bpFMYIM09W3M0nk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
