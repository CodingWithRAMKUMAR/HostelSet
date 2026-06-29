import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// Public client (used in browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  }
})

// Admin client (server-side only)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    })
  : null

// ========== Image Helpers ==========
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
    const { data: { publicUrl } } = supabase.storage
      .from('property-photos')
      .getPublicUrl(filePath)
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

// ========== Auth Helpers ==========

// ✅ FIXED: Removed manual users insert (trigger handles it)
// ✅ FIXED: Added phone to metadata so trigger picks it up
// ✅ NOTE: This is for general use, register-owner uses /api/register-owner instead
export const signUpWithEmail = async (email, password, userData) => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: userData.full_name,
          phone: userData.phone || null,  // ✅ phone now passed to trigger
          role: userData.role || 'owner'
        }
      }
    })
    if (authError) throw authError
    return { success: true, user: authData.user }
  } catch (error) {
    console.error('Signup error:', error)
    return { success: false, error: error.message }
  }
}

// ✅ FIXED: Query by user id not email
// ✅ FIXED: Check is_active so blocked users can't login
export const signInWithEmail = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, id, full_name, phone, is_active, properties(id)')
      .eq('id', data.user.id)  // ✅ query by id not email
      .single()

    if (userError) throw userError

    // ✅ Block inactive users
    if (!userData.is_active) {
      await supabase.auth.signOut()
      throw new Error('Your account has been deactivated. Please contact support.')
    }

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

export const signOut = async () => {
  try {
    await supabase.auth.signOut()
    localStorage.clear()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

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
