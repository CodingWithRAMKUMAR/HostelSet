import { verifyMagicLink } from '../../../lib/auth'

export default async function handler(req, res) {
  const { token } = req.query
  
  if (!token) {
    return res.redirect('/login?error=invalid_token')
  }
  
  try {
    // Verify the magic link
    const { user, email } = await verifyMagicLink(token)
    
    if (user) {
      // User exists - redirect to callback with user info
      const redirectUrl = `/auth/callback?userId=${user.id}&role=${user.role}&email=${encodeURIComponent(email)}`
      return res.redirect(redirectUrl)
      
    } else {
      // New user - need to complete registration
      return res.redirect(`/auth/complete-registration?email=${encodeURIComponent(email)}`)
    }
    
  } catch (error) {
    console.error('Verification error:', error)
    const errorMessage = encodeURIComponent(error.message || 'Invalid or expired magic link')
    return res.redirect(`/login?error=${errorMessage}`)
  }
}
