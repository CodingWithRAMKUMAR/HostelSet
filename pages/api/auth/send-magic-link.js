import { createMagicLink } from '../../../lib/auth'

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const { email } = req.body
  
  // Validate email
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required' })
  }
  
  try {
    console.log('=== MAGIC LINK REQUEST ===')
    console.log('Email:', email)
    
    // Get the app URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hostelset.com'
    console.log('App URL:', appUrl)
    
    // Create magic link in database
    const { token, expiresAt, id } = await createMagicLink(email)
    
    // Create the full magic link URL
    const magicLink = `${appUrl}/api/auth/verify-magic-link?token=${token}`
    
    console.log('Magic link created:', magicLink)
    console.log('Magic link ID:', id)
    
    // For now, return the magic link in the response
    // In production with email service, you would send an email here
    // Since you removed Resend, we'll show the link in the response
    // The frontend will display this link to the user
    
    return res.status(200).json({ 
      success: true, 
      message: 'Magic link created successfully!',
      magicLink: magicLink, // This will be shown to user temporarily
      expiresAt: expiresAt,
      requiresEmail: false // Set to true when you add email service
    })
    
  } catch (error) {
    console.error('=== ERROR CREATING MAGIC LINK ===')
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    
    return res.status(500).json({ 
      error: 'Failed to create magic link',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
    })
  }
}
