import { destroySession } from '../../../lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    // Get session token from cookie
    const sessionToken = req.cookies.session
    
    if (sessionToken) {
      // Destroy the session
      await destroySession(sessionToken)
    }
    
    // Clear the cookie
    res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; Max-Age=0')
    
    return res.status(200).json({ success: true, message: 'Logged out successfully' })
  } catch (error) {
    console.error('Logout error:', error)
    return res.status(500).json({ error: 'Failed to logout' })
  }
}
