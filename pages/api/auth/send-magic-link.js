import { Resend } from 'resend'
import { createMagicLink, getMagicLinkEmailHtml, getMagicLinkEmailText } from '../../../lib/auth'

// Initialize Resend with API key from environment variable
const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const { email, role } = req.body
  
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required' })
  }
  
  try {
    console.log('Sending magic link to:', email)
    
    const { token, expiresAt } = await createMagicLink(email)
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hostelset.vercel.app'
    const magicLink = `${appUrl}/api/auth/verify-magic-link?token=${token}`
    
    const html = getMagicLinkEmailHtml(magicLink, email)
    const text = getMagicLinkEmailText(magicLink)
    
    // ✅ Using Resend's free test sender - works immediately!
    const { data, error } = await resend.emails.send({
      from: 'HostelSet <onboarding@resend.dev>',  // Free, no domain needed
      to: email,
      subject: '🔐 Login to HostelSet',
      html: html,
      text: text,
    })
    
    if (error) {
      console.error('Email send error:', error)
      return res.status(500).json({ error: 'Failed to send email. Please try again.' })
    }
    
    console.log('Email sent successfully:', data)
    
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
