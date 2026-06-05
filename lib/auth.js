import { supabase } from './supabase'

// Generate random token for magic link
export function generateToken() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) + 
         Date.now().toString(36)
}

// Generate session token
export function generateSessionToken() {
  return 'session_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Create magic link in database
export async function createMagicLink(email) {
  // First, invalidate all unused magic links for this email
  await invalidateOldMagicLinks(email)
  
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
  
  const { data, error } = await supabase
    .from('magic_links')
    .insert({
      email: email,
      token: token,
      expires_at: expiresAt.toISOString(),
      used: false
    })
    .select()
    .single()
  
  if (error) throw error
  return { token, expiresAt, id: data.id }
}

// Invalidate old unused magic links
export async function invalidateOldMagicLinks(email) {
  const { error } = await supabase
    .from('magic_links')
    .update({ used: true })
    .eq('email', email)
    .eq('used', false)
  
  if (error) throw error
}

// Verify magic link token
export async function verifyMagicLink(token) {
  // Find the magic link
  const { data: magicLink, error: findError } = await supabase
    .from('magic_links')
    .select('*')
    .eq('token', token)
    .single()
  
  if (findError || !magicLink) {
    throw new Error('Invalid or expired magic link')
  }
  
  // Check if already used
  if (magicLink.used) {
    throw new Error('Magic link already used')
  }
  
  // Check if expired
  if (new Date(magicLink.expires_at) < new Date()) {
    throw new Error('Magic link has expired')
  }
  
  // Mark as used
  await supabase
    .from('magic_links')
    .update({ used: true })
    .eq('id', magicLink.id)
  
  // Get existing user
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('email', magicLink.email)
    .maybeSingle()
  
  return { user: existingUser, email: magicLink.email, magicLinkId: magicLink.id }
}

// Create user session
export async function createUserSession(userId) {
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  
  const { data, error } = await supabase
    .from('user_sessions')
    .insert({
      user_id: userId,
      token: token,
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single()
  
  if (error) throw error
  return { token, expiresAt }
}

// Get user from session token
export async function getUserFromSession(sessionToken) {
  if (!sessionToken) return null
  
  const { data: session, error } = await supabase
    .from('user_sessions')
    .select('*, users(*)')
    .eq('token', sessionToken)
    .single()
  
  if (error || !session) return null
  
  // Check if session expired
  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('user_sessions').delete().eq('id', session.id)
    return null
  }
  
  return session.users
}

// Destroy user session (logout)
export async function destroySession(sessionToken) {
  if (!sessionToken) return
  
  await supabase
    .from('user_sessions')
    .delete()
    .eq('token', sessionToken)
}
