import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../../../lib/supabase'
import { logger } from '../../../lib/logger'
import { getLoginUrl, getResetPasswordUrl } from '../../../lib/server/appUrl'

async function sendApprovalNotification({ email, name }) {
  const apiKey = process.env.BREVO_API_KEY
  const templateId = Number(process.env.BREVO_APPLICATION_APPROVED_TEMPLATE_ID)
  if (!apiKey || !Number.isInteger(templateId) || templateId <= 0) {
    logger.warn('Application approved, but Brevo approval notification is not configured')
    return false
  }

  const loginUrl = getLoginUrl()
  const message = 'Your hostel application has been approved. Please log in to HostelSet to view your room and pay any remaining dues.'
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      to: [{ email, name: name || 'Tenant' }],
      templateId,
      params: {
        applicant_name: name || 'Tenant',
        message,
        login_url: loginUrl,
      },
      tags: ['application-approved'],
    }),
    signal: AbortSignal.timeout(10000),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.message || `Brevo returned HTTP ${response.status}`)
  return true
}

async function inviteTenantForSetup({ email, name, phone }) {
  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: getResetPasswordUrl(),
    data: { full_name: name, phone, role: 'tenant' },
  })
  if (inviteError) throw inviteError
  return invited.user.id
}

async function replaceStaleTenantProfile({ userId, email, name, phone }) {
  const { count, error: activeTenantError } = await supabaseAdmin
    .from('tenants')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['active', 'notice_period', 'payment_pending'])
  if (activeTenantError) throw activeTenantError
  if (count > 0) throw new Error('An active tenant account already exists for these details')

  const { error: deleteProfileError } = await supabaseAdmin.from('users').delete().eq('id', userId).eq('role', 'tenant')
  if (deleteProfileError) throw deleteProfileError
  return inviteTenantForSetup({ email, name, phone })
}

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
    let setupEmailSent = false
    if (type === 'application') {
      const { data: application, error: applicationError } = await supabaseAdmin
        .from('applications')
        .select('id,email,phone,name,user_id,status')
        .eq('id', id)
        .single()
      if (applicationError) throw applicationError
      if (application.status !== 'pending') throw new Error('Application has already been processed')

      let userId = application.user_id
      if (!userId) {
        const [{ data: byPhone }, { data: byEmail }] = await Promise.all([
          supabaseAdmin.from('users').select('id,role,is_active,email').eq('phone', application.phone).limit(1),
          supabaseAdmin.from('users').select('id,role,is_active,phone').eq('email', application.email).limit(1),
        ])
        if (byPhone?.[0] && byEmail?.[0] && byPhone[0].id !== byEmail[0].id) throw new Error('The phone and email belong to different accounts')
        const existing = byPhone?.[0] || byEmail?.[0]
        if (existing && existing.role !== 'tenant') throw new Error('These details belong to an existing non-tenant account')
        userId = existing?.id
      }
      if (!userId) {
        userId = await inviteTenantForSetup({ email: application.email, name: application.name, phone: application.phone })
        createdUserId = userId
        setupEmailSent = true
      } else {
        const { data: authUser, error: authLookupError } = await supabaseAdmin.auth.admin.getUserById(userId)
        if (authLookupError || !authUser?.user) {
          userId = await replaceStaleTenantProfile({ userId, email: application.email, name: application.name, phone: application.phone })
          createdUserId = userId
          setupEmailSent = true
        } else {
          const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(application.email, {
            redirectTo: getResetPasswordUrl(),
          })
          if (resetError) logger.warn('Application approved, but password setup email failed', { message: resetError.message })
          else setupEmailSent = true
        }
      }
      const { error: userError } = await supabaseAdmin.from('users').upsert({
        id: userId,
        email: application.email,
        phone: application.phone,
        full_name: application.name,
        role: 'tenant',
        is_active: true,
      }, { onConflict: 'id' })
      if (userError) throw userError
      const { error: linkError } = await supabaseAdmin.from('applications').update({ user_id: userId }).eq('id', id)
      if (linkError) throw linkError

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

    // Approval is committed independently of the informational notification.
    let notificationEmailSent = false
    try {
      const table = type === 'application' ? 'applications' : 'pre_bookings'
      const { data: approvedRequest } = await supabaseAdmin.from(table).select('name').eq('id', id).maybeSingle()
      notificationEmailSent = await sendApprovalNotification({ email: result.email, name: approvedRequest?.name })
    } catch (notificationError) {
      logger.warn('Application approved, but approval notification failed', { message: notificationError.message })
    }
    return res.status(200).json({ success: true, notificationEmailSent, setupEmailSent })
  } catch (error) {
    if (createdUserId) await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch(() => {})
    logger.error('Approval failed', error, { route: '/api/requests/approve', type })
    return res.status(400).json({ error: error.message || 'Approval failed' })
  }
}
