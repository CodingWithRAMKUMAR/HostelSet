import { Resend } from 'resend'
import { createMagicLink, getMagicLinkEmailHtml, getMagicLinkEmailText } from '../../../lib/auth'

// Initialize Resend with API key from environment variable
const resend = new Resend(process.env.RESEND_API_KEY)

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
    console.log('Sending magic link to:', email)
    
    // Create magic link in database
    const { token, expiresAt } = await createMagicLink(email)
    
    // Get the app URL (works in both development and production)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   (process.env.NODE_ENV === 'production' ? 'https://hostelset.vercel.app' : 'http://localhost:3000')
    const magicLink = `${appUrl}/api/auth/verify-magic-link?token=${token}`
    
    console.log('Magic link generated:', magicLink)
    
    // Generate email content
    const html = getMagicLinkEmailHtml(magicLink, email)
    const text = getMagicLinkEmailText(magicLink)
    
    // Use Resend's verified sender (for testing) OR your verified domain
    // For immediate fix, use Resend's default sender
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    
    console.log('Sending email from:', fromEmail)
    
    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: `HostelSet <${fromEmail}>`,
      to: email,
      subject: '🔐 Login to HostelSet',
      html: html,
      text: text,
    })
    
    if (error) {
      console.error('Email send error details:', error)
      return res.status(500).json({ 
        error: 'Failed to send email. Please verify your email address or try again later.',
        details: error.message 
      })
    }
    
    console.log('Email sent successfully:', data)
    
    // Return success
    return res.status(200).json({ 
      success: true, 
      message: 'Magic link sent to your email',
      expiresAt: expiresAt
    })
    
  } catch (error) {
    console.error('API error details:', error)
    return res.status(500).json({ 
      error: 'Failed to send magic link. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}
