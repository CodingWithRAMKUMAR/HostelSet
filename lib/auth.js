import { supabase } from './supabase'

// Generate random token for magic link
export function generateToken() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) + 
         Date.now().toString(36)
}

// Create magic link in database
export async function createMagicLink(email) {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
  
  const { error } = await supabase
    .from('magic_links')
    .insert({
      email: email,
      token: token,
      expires_at: expiresAt.toISOString(),
      used: false
    })
  
  if (error) throw error
  return { token, expiresAt }
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
  
  return { user: existingUser, email: magicLink.email }
}

// Generate email HTML for magic link
export function getMagicLinkEmailHtml(magicLink, email) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login to HostelSet</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 500px;
          margin: 0 auto;
          padding: 20px;
        }
        .card {
          background-color: #ffffff;
          border-radius: 16px;
          padding: 40px 30px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          text-align: center;
        }
        .logo {
          font-size: 48px;
          margin-bottom: 20px;
        }
        h1 {
          color: #1e293b;
          font-size: 24px;
          margin-bottom: 10px;
        }
        .subtitle {
          color: #64748b;
          font-size: 14px;
          margin-bottom: 30px;
        }
        .button {
          background-color: #1e293b;
          color: white;
          padding: 14px 28px;
          border-radius: 40px;
          text-decoration: none;
          display: inline-block;
          font-weight: 600;
          font-size: 16px;
          margin: 20px 0;
        }
        .button:hover {
          background-color: #334155;
        }
        .expiry {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 20px;
        }
        .footer {
          margin-top: 30px;
          font-size: 12px;
          color: #94a3b8;
          text-align: center;
        }
        .divider {
          border-top: 1px solid #e2e8f0;
          margin: 20px 0;
        }
        .note {
          background-color: #f8fafc;
          padding: 12px;
          border-radius: 8px;
          font-size: 12px;
          color: #475569;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">🏠</div>
          <h1>Login to HostelSet</h1>
          <p class="subtitle">Click the button below to securely log in to your account</p>
          
          <a href="${magicLink}" class="button" style="color: white;">🔐 Login to HostelSet →</a>
          
          <div class="expiry">
            ⏰ This link will expire in 15 minutes
          </div>
          
          <div class="divider"></div>
          
          <div class="note">
            <strong>💡 One-click access</strong><br>
            No password to remember. No OTP to type.<br>
            Just click the button and you're in!
          </div>
        </div>
        
        <div class="footer">
          <p>Set Your Hostel, Simplify Life</p>
          <p style="margin-top: 8px;">
            Sent to: ${email}<br>
            If you didn't request this, please ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

// Get plain text version for email clients that don't support HTML
export function getMagicLinkEmailText(magicLink) {
  return `
    Login to HostelSet
    
    Click the link below to log in to your account:
    
    ${magicLink}
    
    This link will expire in 15 minutes.
    
    If you didn't request this, please ignore this email.
    
    Set Your Hostel, Simplify Life
  `
}
