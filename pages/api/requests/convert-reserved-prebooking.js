import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { allowPostOnly, requireJson, setPrivateApiResponse } from '../../../lib/server/publicApiSecurity'
import { convertReservedPrebooking } from '../../../lib/server/prebookingConversion'
import { logger } from '../../../lib/logger'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } }

export default async function handler(req, res) {
  setPrivateApiResponse(res)
  if (!allowPostOnly(req, res) || !requireJson(req, res)) return
  if (!supabaseAdmin) return res.status(503).json({ error: 'Pre-booking conversion service is unavailable' })

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Authentication required' })

  const { roomId = null, bookingId = null } = req.body || {}
  if (roomId && !UUID.test(String(roomId))) return res.status(400).json({ error: 'Invalid room id' })
  if (bookingId && !UUID.test(String(bookingId))) return res.status(400).json({ error: 'Invalid pre-booking id' })
  if (!roomId && !bookingId) return res.status(400).json({ error: 'A room or pre-booking id is required' })

  const caller = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { data: auth, error: authError } = await caller.auth.getUser(token)
    if (authError || !auth?.user) return res.status(401).json({ error: 'Session expired. Please log in again.' })

    const { data: actor, error: actorError } = await supabaseAdmin
      .from('users')
      .select('id,role,is_active')
      .eq('id', auth.user.id)
      .single()
    if (actorError || !actor?.is_active || !['owner', 'admin'].includes(actor?.role)) {
      return res.status(403).json({ error: 'Owner or admin access required' })
    }

    const result = await convertReservedPrebooking({ caller, actorId: actor.id, roomId, bookingId })
    return res.status(200).json({ success: true, ...result })
  } catch (error) {
    logger.error('Reserved pre-booking conversion API failed', error, { route: '/api/requests/convert-reserved-prebooking', roomId, bookingId })
    const status = /not authorized|access required/i.test(error?.message || '') ? 403
      : /not found/i.test(error?.message || '') ? 404
        : /already|full|conflict|duplicate/i.test(error?.message || '') ? 409
          : 400
    return res.status(status).json({ error: error.message || 'Pre-booking conversion failed' })
  }
}
