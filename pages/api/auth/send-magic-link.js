import { Resend } from 'resend'
import { createMagicLink, getMagicLinkEmailHtml, getMagicLinkEmailText } from '../../../lib/auth'

// Initialize Resend with your API key
const resend = new Resend('re_91MHRLpk_DCojSpJ5CnLM8Fqh9MnPdsdG')

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
    // Create magic link in database
    const { token, expiresAt } = await createMagicLink(email)
    
    // Get the app URL (works in both development and production)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const magicLink = `${appUrl}/api/auth/verify-magic-link?token=${token}`
    
    // Generate email content
    const html = getMagicLinkEmailHtml(magicLink, email)
    const text = getMagicLinkEmailText(magicLink)
    
    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: 'HostelSet <noreply@hostelset.com>',
      to: email,
      subject: '🔐 Login to HostelSet',
      html: html,
      text: text,
    })
    
    if (error) {
      console.error('Email send error:', error)
      return res.status(500).json({ error: 'Failed to send email. Please try again.' })
    }
    
    // Return success
    return res.status(200).json({ 
      success: true, 
      message: 'Magic link sent to your email',
      expiresAt: expiresAt
    })
    
  } catch (error) {
    console.error('API error:', error)
    return res.status(500).json({ error: 'Failed to send magic link. Please try again.' })
  }
}
