import { supabase } from '../../../lib/supabase'
import { createUserSession } from '../../../lib/auth'

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const { email, phone, full_name, role, token } = req.body
  
  // Validate all required fields
  if (!email || !phone || !full_name || !role || !token) {
    return res.status(400).json({ error: 'All fields including token are required' })
  }
  
  // Validate phone number (10 digits)
  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Enter valid 10-digit phone number' })
  }
  
  // Validate email format
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Enter valid email address' })
  }
  
  try {
    console.log('=== COMPLETING REGISTRATION ===')
    console.log('Email:', email)
    console.log('Phone:', phone)
    console.log('Name:', full_name)
    console.log('Role:', role)
    
    // First, verify the magic link is still valid and not used
    const { data: magicLink, error: magicError } = await supabase
      .from('magic_links')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single()
    
    if (magicError || !magicLink) {
      console.error('Magic link not found or already used')
      return res.status(400).json({ error: 'Invalid or expired magic link. Please request a new one.' })
    }
    
    // Check if magic link email matches
    if (magicLink.email !== email) {
      console.error('Email mismatch:', magicLink.email, 'vs', email)
      return res.status(400).json({ error: 'Email mismatch. Please use the correct email.' })
    }
    
    // Check if email already exists (double check)
    const { data: existingEmail, error: emailCheckError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()
    
    if (existingEmail) {
      console.error('Email already exists:', email)
      return res.status(400).json({ error: 'Email already registered. Please login instead.' })
    }
    
    // Check if phone number already exists
    const { data: existingPhone, error: phoneCheckError } = await supabase
      .from('users')
      .select('id, phone')
      .eq('phone', phone)
      .maybeSingle()
    
    if (existingPhone) {
      console.error('Phone already exists:', phone)
      return res.status(400).json({ error: 'Phone number already registered. Please login.' })
    }
    
    // Create new user
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email: email,
        phone: phone,
        full_name: full_name,
        role: role,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (createError) {
      console.error('Create user error:', createError)
      throw createError
    }
    
    console.log('User created successfully:', newUser.id)
    
    // Mark magic link as used
    await supabase
      .from('magic_links')
      .update({ used: true })
      .eq('id', magicLink.id)
    
    // Create session for the new user
    const { token: sessionToken } = await createUserSession(newUser.id)
    
    // Set cookie
    res.setHeader('Set-Cookie', `session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`)
    
    console.log('Session created, redirecting to dashboard')
    
    // Return success with user info
    return res.status(200).json({ 
      success: true, 
      userId: newUser.id,
      role: newUser.role,
      message: 'Registration completed successfully!'
    })
    
  } catch (error) {
    console.error('=== REGISTRATION ERROR ===')
    console.error('Error:', error)
    return res.status(500).json({ 
      error: 'Failed to complete registration. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}
