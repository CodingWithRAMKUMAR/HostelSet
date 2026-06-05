import { Resend } from 'resend'
import { createMagicLink, getMagicLinkEmailHtml, getMagicLinkEmailText } from '../../../lib/auth'

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const { email, role } = req.body
  
  // Validate email
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required' })
  }
  
  try {
    console.log('=== MAGIC LINK REQUEST START ===')
    console.log('Email:', email)
    console.log('Environment:', process.env.NODE_ENV)
    console.log('Has RESEND_API_KEY:', !!process.env.RESEND_API_KEY)
    
    // Create magic link in database
    const { token, expiresAt } = await createMagicLink(email)
    
    // Get the app URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   (process.env.NODE_ENV === 'production' 
                     ? 'https://hostelset.vercel.app' 
                     : 'http://localhost:3000')
    
    const magicLink = `${appUrl}/api/auth/verify-magic-link?token=${token}`
    console.log('Magic link created:', magicLink)
    
    // Initialize Resend with API key
    const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_91MHRLpk_DCojSpJ5CnLM8Fqh9MnPdsdG'
    const resend = new Resend(RESEND_API_KEY)
    
    // Generate email content
    const html = getMagicLinkEmailHtml(magicLink, email)
    const text = getMagicLinkEmailText(magicLink)
    
    // Try sending email with proper error handling
    console.log('Attempting to send email...')
    
    const { data, error } = await resend.emails.send({
      from: 'HostelSet <onboarding@resend.dev>',
      to: email,
      subject: '🔐 Login to HostelSet - Magic Link',
      html: html,
      text: text,
    })
    
    if (error) {
      console.error('Resend error details:', JSON.stringify(error, null, 2))
      throw new Error(error.message || 'Failed to send email')
    }
    
    console.log('Email sent successfully!', data)
    console.log('=== MAGIC LINK REQUEST END ===')
    
    // Return success
    return res.status(200).json({ 
      success: true, 
      message: '✨ Magic link sent! Check your email (spam folder too)',
      expiresAt: expiresAt
    })
    
  } catch (error) {
    console.error('=== ERROR SENDING MAGIC LINK ===')
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    
    // Return detailed error for debugging
    return res.status(500).json({ 
      error: 'Failed to send magic link',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later',
      suggestion: 'Make sure RESEND_API_KEY is set correctly in environment variables'
    })
  }
}
