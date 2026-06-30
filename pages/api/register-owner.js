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
    location,
  } = req.body

  if (!email || !password || !phone || !full_name || !property_name || !address || !city) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  const latitude = Number(location?.latitude)
  const longitude = Number(location?.longitude)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'A valid property map location is required' })
  }

  const cleanPhone = cleanPhoneNumber(phone)
  if (cleanPhone.length !== 10) {
    return res.status(400).json({ error: 'Invalid phone number' })
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY missing' })
  }

  try {
    // 1. Create Auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: 'owner' },
    })

    if (authError) {
      console.error('Auth error:', authError)
      return res.status(500).json({ error: 'Auth error: ' + authError.message })
    }

    const userId = authData.user.id

    // 2. Call the DB function
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

    // 3. Check the function result
    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      console.error('Database function error:', dbError)
      return res.status(500).json({ error: 'Database function error: ' + dbError.message })
    }

    if (!data || !data.success) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      console.error('Function returned error:', data)
      return res.status(400).json({ error: data?.error || 'Registration failed' })
    }

    const { error: locationError } = await supabaseAdmin.from('properties').update({
      latitude,
      longitude,
      formatted_address: String(location.formatted_address || address).slice(0, 500),
      location_place_id: location.location_place_id || null,
      location_verified: false,
    }).eq('id', data.property_id).eq('owner_id', userId)
    if (locationError) {
      console.error('Property location update error:', locationError)
      return res.status(500).json({ error: 'Registration completed, but map location could not be saved. Contact support.' })
    }

    // Success
    return res.status(200).json({
      success: true,
      message: 'Registration successful! Please login.',
      userId: userId,
      propertyId: data.property_id
    })
  } catch (error) {
    console.error('Registration error:', error)
    return res.status(500).json({
      error: error.message || 'Registration failed. Please try again.'
    })
  }
}
