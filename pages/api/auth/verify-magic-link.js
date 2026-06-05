import { supabase } from '../../../lib/supabase'
import { verifyMagicLink, createUserSession } from '../../../lib/auth'

export default async function handler(req, res) {
  const { token } = req.query
  
  if (!token) {
    return res.redirect('/login?error=Invalid token')
  }
  
  try {
    console.log('=== VERIFYING MAGIC LINK ===')
    console.log('Token:', token)
    
    // Verify the magic link
    const { user, email, magicLinkId } = await verifyMagicLink(token)
    
    if (user) {
      // Existing user - create session and redirect to dashboard
      console.log('Existing user found:', user.id, user.email)
      
      const { token: sessionToken } = await createUserSession(user.id)
      
      // Set cookie
      res.setHeader('Set-Cookie', `session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`)
      
      // Redirect based on role
      if (user.role === 'owner') {
        console.log('Redirecting to owner dashboard')
        return res.redirect('/owner/dashboard')
      } else if (user.role === 'tenant') {
        console.log('Redirecting to tenant dashboard')
        return res.redirect('/tenant/dashboard')
      } else {
        return res.redirect('/login?error=Invalid role')
      }
      
    } else {
      // New user - redirect to complete registration
      console.log('New user, redirecting to registration:', email)
      return res.redirect(`/auth/complete-registration?email=${encodeURIComponent(email)}&token=${token}`)
    }
    
  } catch (error) {
    console.error('=== VERIFICATION ERROR ===')
    console.error('Error:', error.message)
    return res.redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }
}
