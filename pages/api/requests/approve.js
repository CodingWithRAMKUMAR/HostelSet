import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabaseAdmin) return res.status(503).json({ error: 'Approval service is unavailable' })
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Authentication required' })

  const caller = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: auth, error: authError } = await caller.auth.getUser(token)
  if (authError || !auth?.user) return res.status(401).json({ error: 'Session expired. Please log in again.' })

  const { type, id } = req.body || {}
  if (!id || !['application', 'prebooking'].includes(type)) return res.status(400).json({ error: 'Invalid approval request' })

  let createdUserId = null
  try {
    let result
    if (type === 'application') {
      const response = await caller.rpc('approve_application_atomic', { p_application_id: id })
      if (response.error) throw response.error
      result = response.data
    } else {
      const { data: booking, error: bookingError } = await supabaseAdmin.from('pre_bookings')
        .select('email, phone, name, user_id').eq('id', id).single()
      if (bookingError) throw bookingError
      let userId = booking.user_id
      if (!userId) {
        const [{ data: byPhone }, { data: byEmail }] = await Promise.all([
          supabaseAdmin.from('users').select('id').eq('phone', booking.phone).limit(1),
          supabaseAdmin.from('users').select('id').eq('email', booking.email).limit(1),
        ])
        if (byPhone?.[0] && byEmail?.[0] && byPhone[0].id !== byEmail[0].id) throw new Error('The phone and email belong to different accounts')
        userId = byPhone?.[0]?.id || byEmail?.[0]?.id
      }
      if (!userId) {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email: booking.email,
          password: `${crypto.randomBytes(18).toString('base64url')}Aa1!`,
          email_confirm: true,
          user_metadata: { full_name: booking.name, phone: booking.phone, role: 'tenant' },
        })
        if (error) throw error
        userId = created.user.id
        createdUserId = userId
        const { error: userError } = await supabaseAdmin.from('users').upsert({
          id: userId, email: booking.email, phone: booking.phone, full_name: booking.name, role: 'tenant', is_active: true,
        })
        if (userError) throw userError
      }
      const response = await caller.rpc('approve_prebooking_atomic', { p_booking_id: id, p_user_id: userId })
      if (response.error) throw response.error
      result = response.data
    }

    // Approval remains committed even if mail delivery temporarily fails; owners
    // retain the existing resend control for recovery.
    let emailSent = true
    const { error: mailError } = await supabaseAdmin.auth.resetPasswordForEmail(result.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://hostelset.com'}/reset-password`,
    })
    if (mailError) {
      emailSent = false
      console.error('Approval password email failed:', mailError)
    }
    return res.status(200).json({ success: true, emailSent })
  } catch (error) {
    if (createdUserId) await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch(() => {})
    console.error('Approval failed:', error)
    return res.status(400).json({ error: error.message || 'Approval failed' })
  }
}
