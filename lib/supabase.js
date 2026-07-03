import { createClient } from '@supabase/supabase-js'
import { fetchWithTimeout } from './fetchWithTimeout'

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

export const getPrivateDocumentUrl = async (path, expiresIn = 300) => {
  if (!path) return null

  let objectPath = path
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path)
      const marker = '/storage/v1/object/'
      const markerIndex = url.pathname.indexOf(marker)
      if (markerIndex === -1) return path

      const storagePath = url.pathname.slice(markerIndex + marker.length)
      const match = storagePath.match(/^(?:(?:public|sign|authenticated)\/)?tenant-documents\/(.+)$/)
      if (!match) return path
      objectPath = decodeURIComponent(match[1])
    } catch {
      return null
    }
  }

  if (/^tenant-documents\//i.test(objectPath)) {
    objectPath = objectPath.replace(/^tenant-documents\//i, '')
  }
  if (objectPath.startsWith('/')) {
    objectPath = objectPath.slice(1)
  }

  const { data, error } = await supabase.storage.from('tenant-documents').createSignedUrl(objectPath, expiresIn)
  if (error) {
    console.error('Unable to sign private document:', error.message)
    return null
  }
  return data.signedUrl
}

const getTenantDocumentContactFilter = (phone, email) => {
  const conditions = []
  if (phone) conditions.push(`phone.eq.${phone}`)
  if (email) conditions.push(`email.eq.${email.trim().toLowerCase()}`)
  return conditions.length ? conditions.join(',') : null
}

export const signPrivateDocumentFields = async (record, fields) => {
  if (!record) return record
  const signed = await Promise.all(fields.map(field => getPrivateDocumentUrl(record[field])))
  return fields.reduce((result, field, index) => ({ ...result, [field]: signed[index] }), { ...record })
}

export const findTenantDocumentRecord = async (tenant, propertyId) => {
  if (!tenant || !propertyId) return { record: null, source_type: null }
  const statuses = ['approved', 'pending']
  let application = null
  let preBooking = null
  if (tenant.user_id) {
    const [applicationResult, preBookingResult] = await Promise.all([
      supabase.from('applications')
        .select('*')
        .eq('property_id', propertyId)
        .eq('user_id', tenant.user_id)
        .in('status', statuses)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase.from('pre_bookings')
        .select('*')
        .eq('property_id', propertyId)
        .eq('user_id', tenant.user_id)
        .in('status', statuses)
        .order('created_at', { ascending: false })
        .limit(1),
    ])
    if (applicationResult.error) throw applicationResult.error
    if (preBookingResult.error) throw preBookingResult.error
    application = applicationResult.data?.[0]
    preBooking = preBookingResult.data?.[0]
  }

  if (!application && !preBooking) {
    const contactFilter = getTenantDocumentContactFilter(tenant.phone, tenant.email || '')
    if (contactFilter) {
      const [legacyApplication, legacyPreBooking] = await Promise.all([
        supabase.from('applications')
          .select('*')
          .eq('property_id', propertyId)
          .in('status', statuses)
          .or(contactFilter)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase.from('pre_bookings')
          .select('*')
          .eq('property_id', propertyId)
          .in('status', statuses)
          .or(contactFilter)
          .order('created_at', { ascending: false })
          .limit(1),
      ])
      if (legacyApplication.error) throw legacyApplication.error
      if (legacyPreBooking.error) throw legacyPreBooking.error
      application = legacyApplication.data?.[0]
      preBooking = legacyPreBooking.data?.[0]
    }
  }

  const candidates = [application, preBooking].filter(Boolean)
  const documentScore = record => ['photo', 'id_proof', 'payment_screenshot'].filter(field => record?.[field]).length
  const record = candidates.sort((left, right) => documentScore(right) - documentScore(left) || new Date(right.created_at) - new Date(left.created_at))[0] || null
  const source_type = record === preBooking ? 'pre_booking' : 'application'
  return { record, source_type }
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
      .select('role, id, full_name, phone, is_active')
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

    return { success: true, user: data.user, session: data.session, role: userData.role, userData }
  } catch (error) {
    console.error('Signin error:', error)
    return { success: false, error: error.message }
  }
}

let sessionSyncPromise = null
let syncedAccessToken = null

export const syncServerSession = async (session) => {
  const accessToken = session?.access_token || null
  if (accessToken && accessToken === syncedAccessToken) return
  if (sessionSyncPromise?.token === accessToken) return sessionSyncPromise.promise

  const promise = fetchWithTimeout('/api/auth/session', {
    method: session ? 'POST' : 'DELETE',
    headers: session ? { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } : undefined,
    body: session ? JSON.stringify({ refreshToken: session.refresh_token }) : undefined,
  }, 10000).then((response) => {
    if (!response.ok && response.status !== 204) throw new Error('Unable to establish secure session')
    syncedAccessToken = accessToken
  }).finally(() => {
    if (sessionSyncPromise?.promise === promise) sessionSyncPromise = null
  })

  sessionSyncPromise = { token: accessToken, promise }
  return promise
}

export const signOut = async () => {
  try {
    await supabase.auth.signOut()
    await syncServerSession(null).catch(() => {})
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
