import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yzfggwnkawicwlniflnn.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6Zmdnd25rYXdpY3dsbmlmbG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzQxNjYsImV4cCI6MjA5NTYxMDE2Nn0.FGm5Xo35eM2Ms-fNKnTtmop1W_55bpFMYIM09W3M0nk'

// For environment variables (recommended), uncomment and use these:
// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Public client (for browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,   // ← ESSENTIAL for password reset callback
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  }
})

// ========== ADMIN CLIENT (server-side only) ==========
// The service role key must be set in environment variables: SUPABASE_SERVICE_ROLE_KEY
// Get it from Supabase Dashboard → Settings → API → Service role key
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Only create admin client if the key is available (server-side)
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    })
  : null

// ========== EXISTING FUNCTIONS (keep as they are) ==========
export const uploadImage = async (file, folder = 'property-photos') => {
  try {
    if (!file) throw new Error('No file provided')
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only JPEG, PNG, WEBP, and GIF images are allowed')
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image size must be less than 5MB')
    }
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`
    const filePath = `${folder}/${fileName}`
    const { data, error } = await supabase.storage
      .from('property-photos')
      .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('property-photos').getPublicUrl(filePath)
    return publicUrl
  } catch (error) {
    console.error('Upload error:', error)
    throw error
  }
}

export const deleteImage = async (imageUrl) => {
  try {
    const urlParts = imageUrl.split('/')
    const filePath = urlParts.slice(urlParts.indexOf('property-photos') + 1).join('/')
    const { error } = await supabase.storage.from('property-photos').remove([filePath])
    if (error) throw error
    return true
  } catch (error) {
    console.error('Delete image error:', error)
    return false
  }
}

// ========== AUTH HELPERS ==========

// Sign up with email & password (for owners) – DEPRECATED (use API route instead)
export const signUpWithEmail = async (email, password, userData) => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: userData.full_name, role: userData.role } }
    })
    if (authError) throw authError

    const { error: userError } = await supabase.from('users').insert({
      id: authData.user.id,
      email: email,
      full_name: userData.full_name,
      phone: userData.phone,
      role: userData.role,
      is_active: true
    })
    if (userError) throw userError

    return { success: true, user: authData.user }
  } catch (error) {
    console.error('Signup error:', error)
    return { success: false, error: error.message }
  }
}

// Sign in with email & password
export const signInWithEmail = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, id, full_name, phone')
      .eq('email', email)
      .single()
    if (userError) throw userError

    localStorage.setItem('userId', userData.id)
    localStorage.setItem('userRole', userData.role)
    localStorage.setItem('isLoggedIn', 'true')
    localStorage.setItem('userName', userData.full_name)
    localStorage.setItem('userEmail', email)

    return { success: true, user: data.user, role: userData.role, userData }
  } catch (error) {
    console.error('Signin error:', error)
    return { success: false, error: error.message }
  }
}

// Sign out
export const signOut = async () => {
  try {
    await supabase.auth.signOut()
    localStorage.clear()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Reset password (sends email with reset link)
export const resetPassword = async (email) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
