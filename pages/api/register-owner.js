import { supabase } from '../../lib/supabase'
import { cleanPhoneNumber } from '../../lib/utils'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    email,
    password,
    phone,
    full_name,
    property_name,
    description,
    address,
    city,
    pincode,
    property_type,
    amenities,
    photos,
  } = req.body

  // Validate required fields
  if (!email || !password || !phone || !full_name || !property_name || !address || !city) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const cleanPhone = cleanPhoneNumber(phone)
  if (cleanPhone.length !== 10) {
    return res.status(400).json({ error: 'Invalid phone number' })
  }

  try {
    // Step 1: Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: 'owner' },
    })

    if (authError) throw authError

    const userId = authData.user.id

    // Step 2: Call the DB function
    const { data, error: dbError } = await supabase.rpc('register_owner_and_property', {
      p_user_id: userId,
      p_phone: cleanPhone,
      p_email: email,
      p_full_name: full_name,
      p_property_name: property_name,
      p_description: description || '',
      p_address: address,
      p_city: city,
      p_pincode: pincode || '',
      p_property_type: property_type || 'boys',
      p_amenities: amenities || [],
      p_photos: photos || [],
    })

    // If DB transaction failed, delete the auth user
    if (dbError || !data.success) {
      // Delete the auth user (cleanup)
      await supabase.auth.admin.deleteUser(userId)
      throw new Error(dbError?.message || data?.error || 'Database transaction failed')
    }

    // Success
    return res.status(200).json({
      success: true,
      message: 'Registration successful! Please login.',
    })
  } catch (error) {
    console.error('Registration error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Registration failed. Please try again.',
    })
  }
}
