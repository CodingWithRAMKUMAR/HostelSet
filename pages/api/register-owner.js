import { supabaseAdmin } from '../../lib/supabase'
import { cleanPhoneNumber } from '../../lib/utils'

export default async function handler(req, res) {
  // Only allow POST
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

  // Ensure admin client is available
  if (!supabaseAdmin) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  try {
    // 1️⃣ Create Auth user (using admin client to auto‑confirm email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,   // email verified immediately
      user_metadata: { full_name, role: 'owner' },
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      throw new Error(authError.message)
    }

    const userId = authData.user.id

    // 2️⃣ Call the database function (atomic transaction)
    const { data, error: dbError } = await supabaseAdmin.rpc('register_owner_and_property', {
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

    // 3️⃣ If the DB transaction failed, delete the auth user (rollback)
    if (dbError || (data && !data.success)) {
      // Delete the auth user (cleanup)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      const errorMsg = dbError?.message || data?.error || 'Database transaction failed'
      console.error('DB function error:', errorMsg)
      throw new Error(errorMsg)
    }

    // ✅ Success – everything committed
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
