import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { logger } from '../../../lib/logger'
import { allowPostOnly, enforceRateLimit, getClientIp, requireJson, setPrivateApiResponse } from '../../../lib/server/publicApiSecurity'
import phoneLogin from '../../../lib/server/phoneLogin'

const { normalizeIndianPhone, resolvePhoneLoginEmail } = phoneLogin

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } }

export default async function handler(req, res) {
  setPrivateApiResponse(res)
  if (!allowPostOnly(req, res) || !requireJson(req, res)) return

  if (!supabaseAdmin) {
    const message = process.env.NODE_ENV === 'production'
      ? 'Service unavailable'
      : 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY'
    return res.status(503).json({ error: message })
  }

  const ip = getClientIp(req)
  if (!await enforceRateLimit(req, res, { scope: 'phone-resolution-ip', identifier: ip, limit: 20, windowSeconds: 900 })) return

  const { phone } = req.body || {}
  const normalizedPhone = normalizeIndianPhone(phone)
  if (!normalizedPhone) {
    return res.status(404).json({ error: 'No account found with this phone number.' })
  }
  if (!await enforceRateLimit(req, res, { scope: 'phone-resolution-phone', identifier: normalizedPhone, limit: 5, windowSeconds: 3600 })) return

  try {
    const result = await resolvePhoneLoginEmail({ supabase: supabaseAdmin, phone: normalizedPhone, logger })
    if (result.ok) return res.status(200).json({ email: result.email })
    return res.status(result.status || 404).json({ error: result.publicMessage || 'No account found with this phone number.' })
  } catch (error) {
    logger.error('Phone resolution failed', error, { route: '/api/auth/resolve-phone' })
    const message = process.env.NODE_ENV === 'production'
      ? 'Unable to resolve phone login'
      : `Phone resolution failed: ${error.message || error}`
    return res.status(500).json({ error: message })
  }
}
