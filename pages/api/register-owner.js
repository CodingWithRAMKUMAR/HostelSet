import { supabaseAdmin } from '../../lib/supabase'
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

  // Validate
  if (!email || !password || !phone || !full_name || !property_name || !address || !city) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const cleanPhone = cleanPhoneNumber(phone)
  if (cleanPhone.length !== 10) {
    return res.status(400).json({ error: 'Invalid phone number' })
  }

  if (!supabaseAdmin) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  try {
    // 1. Create Auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: 'owner' },
    })
    if (authError) throw new Error(authError.message)

    const userId = authData.user.id

    // 2. Insert into public.users using admin client (bypasses RLS)
    const { error: userInsertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        phone: cleanPhone,
        email: email.toLowerCase(),
        full_name: full_name,
        role: 'owner',
        is_active: true,
      })
    if (userInsertError) {
      // If user insert fails, delete the auth user (rollback)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      throw new Error(userInsertError.message)
    }

    // 3. Call the function to insert property and settings
    const { data, error: dbError } = await supabaseAdmin.rpc('register_owner_property', {
      p_user_id: userId,
      p_property_name: property_name,
      p_description: description || '',
      p_address: address,
      p_city: city,
      p_pincode: pincode || '',
      p_property_type: property_type || 'boys',
      p_amenities: amenities || [],
      p_photos: photos || [],
    })

    if (dbError || (data && !data.success)) {
      // Rollback: delete auth user and public.user
      await supabaseAdmin.auth.admin.deleteUser(userId)
      await supabaseAdmin.from('users').delete().eq('id', userId)
      throw new Error(dbError?.message || data?.error || 'Property insertion failed')
    }

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
