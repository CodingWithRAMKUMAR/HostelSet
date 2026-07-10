import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { logger } from '../../../lib/logger'
import { allowPostOnly, enforceRateLimit, getClientIp, requireJson, setPrivateApiResponse } from '../../../lib/server/publicApiSecurity'
import { cleanPhoneNumber } from '../../../lib/utils'

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
  const normalizedPhone = cleanPhoneNumber(phone)
  if (!/^[0-9]{10}$/.test(normalizedPhone)) {
    return res.status(404).json({ error: 'No account found with this phone number.' })
  }
  if (!await enforceRateLimit(req, res, { scope: 'phone-resolution-phone', identifier: normalizedPhone, limit: 5, windowSeconds: 3600 })) return

  try {
    const { data: userByPhone, error: userError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('phone', normalizedPhone)
      .maybeSingle()
    if (userError) throw userError

    if (userByPhone?.email) {
      return res.status(200).json({ email: userByPhone.email })
    }

    const { data: tenantByPhone, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('user_id')
      .eq('phone', normalizedPhone)
      .maybeSingle()
    if (tenantError) throw tenantError

    if (tenantByPhone?.user_id) {
      const { data: linkedUser, error: linkedUserError } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', tenantByPhone.user_id)
        .maybeSingle()
      if (linkedUserError) throw linkedUserError
      if (linkedUser?.email) {
        return res.status(200).json({ email: linkedUser.email })
      }
    }

    return res.status(404).json({ error: 'No account found with this phone number.' })
  } catch (error) {
    logger.error('Phone resolution failed', error, { route: '/api/auth/resolve-phone' })
    const message = process.env.NODE_ENV === 'production'
      ? 'Unable to resolve phone login'
      : `Phone resolution failed: ${error.message || error}`
    return res.status(500).json({ error: message })
  }
}
