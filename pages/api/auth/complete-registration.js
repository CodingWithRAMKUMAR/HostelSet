import { supabase } from '../../../lib/supabase'

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const { email, phone, full_name, role } = req.body
  
  // Validate all required fields
  if (!email || !phone || !full_name || !role) {
    return res.status(400).json({ error: 'All fields are required' })
  }
  
  // Validate phone number (10 digits)
  if (phone.length !== 10) {
    return res.status(400).json({ error: 'Enter valid 10-digit phone number' })
  }
  
  // Validate email format
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Enter valid email address' })
  }
  
  try {
    // Check if user already exists with this email
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists. Please login.' })
    }
    
    // Check if phone number already exists
    const { data: existingPhone } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()
    
    if (existingPhone) {
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
        is_active: true
      })
      .select()
      .single()
    
    if (createError) {
      console.error('Create user error:', createError)
      throw createError
    }
    
    // Return success with user info
    return res.status(200).json({ 
      success: true, 
      userId: newUser.id,
      role: newUser.role
    })
    
  } catch (error) {
    console.error('Registration error:', error)
    return res.status(500).json({ error: 'Failed to complete registration. Please try again.' })
  }
}
