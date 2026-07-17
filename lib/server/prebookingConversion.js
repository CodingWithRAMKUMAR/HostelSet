import crypto from 'crypto'
import { supabaseAdmin } from './supabaseAdmin'
import { logger } from '../logger'
import { getResetPasswordUrl } from './appUrl'

function randomPassword() {
  return `${crypto.randomBytes(24).toString('base64url')}aA1!`
}

async function sendSetupEmail(email) {
  const redirectTo = getResetPasswordUrl()
  if (process.env.NODE_ENV !== 'production') {
    console.info('[HostelSet] reset link requested', { method: 'resetPasswordForEmail', redirectTo })
  }
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}

async function resolveTenantUser({ booking }) {
  const [{ data: byPhone }, { data: byEmail }] = await Promise.all([
    supabaseAdmin.from('users').select('id,role,is_active,email').eq('phone', booking.phone).limit(1),
    supabaseAdmin.from('users').select('id,role,is_active,phone').eq('email', booking.email).limit(1),
  ])
  if (byPhone?.[0] && byEmail?.[0] && byPhone[0].id !== byEmail[0].id) throw new Error('The phone and email belong to different accounts')
  const existing = byPhone?.[0] || byEmail?.[0]
  if (existing && existing.role !== 'tenant') throw new Error('These details belong to an existing non-tenant account')

  let userId = existing?.id || null
  let createdAuthUserId = null
  let createdProfile = false
  if (userId) {
    const { data: authUser, error: authLookupError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (authLookupError || !authUser?.user) {
      const { error: deleteProfileError } = await supabaseAdmin.from('users').delete().eq('id', userId).eq('role', 'tenant')
      if (deleteProfileError) throw deleteProfileError
      userId = null
    }
  }

  if (!userId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: booking.email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { full_name: booking.name, phone: booking.phone, role: 'tenant' },
    })
    if (error) throw error
    userId = data.user.id
    createdAuthUserId = userId
  }

  const { error: userError } = await supabaseAdmin.from('users').upsert({
    id: userId,
    email: booking.email,
    phone: booking.phone,
    full_name: booking.name,
    role: 'tenant',
    is_active: true,
  }, { onConflict: 'id' })
  if (userError) throw userError
  createdProfile = !existing || existing.id !== userId

  return { userId, createdAuthUserId, createdProfile }
}

export async function convertReservedPrebooking({ caller, actorId, roomId = null, bookingId = null }) {
  if (!supabaseAdmin) throw new Error('Pre-booking conversion service is unavailable')
  let createdAuthUserId = null
  let createdProfileId = null
  let conversionCommitted = false
  try {
    let query = supabaseAdmin
      .from('pre_bookings')
      .select('id,property_id,room_id,name,phone,email,status')
      .eq('status', 'reserved')
      .is('deleted_at', null)
      .order('reserved_at', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(1)
    if (bookingId) query = query.eq('id', bookingId)
    else if (roomId) query = query.eq('room_id', roomId)
    else throw new Error('A room or pre-booking id is required')

    const { data: bookings, error: bookingError } = await query
    if (bookingError) throw bookingError
    const booking = bookings?.[0]
    if (!booking) return { converted: false, reason: 'no-reserved-prebooking' }

    const resolved = await resolveTenantUser({ booking })
    createdAuthUserId = resolved.createdAuthUserId
    createdProfileId = resolved.createdProfile ? resolved.userId : null

    const response = await caller.rpc('convert_reserved_prebooking_to_tenant', {
      p_booking_id: booking.id,
      p_user_id: resolved.userId,
      p_converted_by: actorId,
    })
    if (response.error) throw response.error
    const result = response.data || {}
    conversionCommitted = true

    let setupEmailSent = false
    if (!result.already_converted) {
      try {
        await sendSetupEmail(booking.email)
        setupEmailSent = true
        await supabaseAdmin
          .from('pre_bookings')
          .update({ conversion_invite_sent_at: new Date().toISOString() })
          .eq('id', booking.id)
          .is('conversion_invite_sent_at', null)
      } catch (emailError) {
        logger.warn('Reserved pre-booking converted, but setup email failed', { message: emailError.message, bookingId: booking.id })
      }
    }

    return {
      converted: true,
      setupEmailSent,
      bookingId: booking.id,
      tenantId: result.tenant_id || null,
      alreadyConverted: Boolean(result.already_converted),
    }
  } catch (error) {
    if (!conversionCommitted && createdProfileId) {
      try { await supabaseAdmin.from('users').delete().eq('id', createdProfileId).eq('role', 'tenant') } catch {}
    }
    if (!conversionCommitted && createdAuthUserId) {
      try { await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId) } catch {}
    }
    logger.error('Reserved pre-booking conversion failed', error, { roomId, bookingId })
    throw error
  }
}
