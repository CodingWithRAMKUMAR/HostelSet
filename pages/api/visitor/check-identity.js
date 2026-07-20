import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { cleanPhoneNumber } from '../../../lib/utils'
import {
  allowPostOnly,
  enforceRateLimit,
  getClientIp,
  requireJson,
  setPrivateApiResponse,
} from '../../../lib/server/publicApiSecurity'
import { logger } from '../../../lib/logger'

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ACTIVE_APPLICATION_STATUSES = ['pending', 'approved']
const ACTIVE_PREBOOKING_STATUSES = ['pending', 'reserved', 'approved']
const UNAVAILABLE_MESSAGE = 'This phone number or email is already associated with an existing account or active request. Please log in or contact the property owner.'

async function hasRows(query) {
  const { data, error } = await query.limit(1)
  if (error) throw error
  return Boolean(data?.length)
}

async function identityExists({ propertyId, phone, email }) {
  const checks = []

  if (phone) {
    checks.push(
      hasRows(supabaseAdmin.from('users').select('id').eq('phone', phone)),
      hasRows(
        supabaseAdmin
          .from('tenants')
          .select('id')
          .eq('phone', phone)
          .eq('status', 'active')
          .is('archived_at', null)
      ),
      hasRows(
        supabaseAdmin
          .from('applications')
          .select('id')
          .eq('property_id', propertyId)
          .eq('phone', phone)
          .in('status', ACTIVE_APPLICATION_STATUSES)
          .is('deleted_at', null)
      ),
      hasRows(
        supabaseAdmin
          .from('pre_bookings')
          .select('id')
          .eq('property_id', propertyId)
          .eq('phone', phone)
          .in('status', ACTIVE_PREBOOKING_STATUSES)
          .is('deleted_at', null)
      )
    )
  }

  if (email) {
    checks.push(
      hasRows(supabaseAdmin.from('users').select('id').eq('email', email)),
      hasRows(
        supabaseAdmin
          .from('tenants')
          .select('id')
          .eq('email', email)
          .eq('status', 'active')
          .is('archived_at', null)
      ),
      hasRows(
        supabaseAdmin
          .from('applications')
          .select('id')
          .eq('property_id', propertyId)
          .eq('email', email)
          .in('status', ACTIVE_APPLICATION_STATUSES)
          .is('deleted_at', null)
      ),
      hasRows(
        supabaseAdmin
          .from('pre_bookings')
          .select('id')
          .eq('property_id', propertyId)
          .eq('email', email)
          .in('status', ACTIVE_PREBOOKING_STATUSES)
          .is('deleted_at', null)
      )
    )
  }

  const results = await Promise.all(checks)
  return results.some(Boolean)
}

async function processIdentityCheck(req, res) {
  setPrivateApiResponse(res)
  if (!allowPostOnly(req, res) || !requireJson(req, res)) return
  if (!supabaseAdmin) return res.status(503).json({ error: 'Verification service is unavailable' })

  const ip = getClientIp(req)
  if (!await enforceRateLimit(req, res, {
    scope: 'visitor-identity-check-ip',
    identifier: ip,
    limit: 40,
    windowSeconds: 600,
  })) return

  const { propertyId, phone: rawPhone, email: rawEmail, kind = 'application' } = req.body || {}
  const phone = rawPhone ? cleanPhoneNumber(rawPhone) : ''
  const email = rawEmail ? String(rawEmail).trim().toLowerCase().slice(0, 254) : ''

  if (!UUID.test(String(propertyId || '')) || !['application', 'prebooking'].includes(kind)) {
    return res.status(400).json({ error: 'Invalid verification request' })
  }
  if (!phone && !email) return res.status(400).json({ error: 'Enter a phone number or email address' })
  if (phone && !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid 10-digit phone number' })
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' })

  const identityKey = `${propertyId}:${phone || '-'}:${email || '-'}:${kind}`
  if (!await enforceRateLimit(req, res, {
    scope: 'visitor-identity-check-value',
    identifier: identityKey,
    limit: 8,
    windowSeconds: 3600,
  })) return

  const { data: isVisible, error: visibilityError } = await supabaseAdmin.rpc('is_public_property_visible', {
    p_property_id: propertyId,
  })
  if (visibilityError) throw visibilityError
  if (!isVisible) return res.status(404).json({ error: 'This property is currently unavailable' })

  const exists = await identityExists({ propertyId, phone, email })
  return res.status(200).json(exists
    ? { available: false, message: UNAVAILABLE_MESSAGE }
    : { available: true })
}

export default async function handler(req, res) {
  try {
    return await processIdentityCheck(req, res)
  } catch (error) {
    logger.error('Visitor identity precheck failed', error, { route: '/api/visitor/check-identity' })
    if (res.headersSent) return res.end()
    setPrivateApiResponse(res)
    return res.status(500).json({ error: 'Could not verify these details. Please try again.' })
  }
}
