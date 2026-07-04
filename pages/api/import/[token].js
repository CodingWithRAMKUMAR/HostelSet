import { supabaseAdmin } from '../../../lib/supabase'
import { enforceRateLimit, getClientIp, setPrivateApiResponse } from '../../../lib/server/publicApiSecurity'
import { logger } from '../../../lib/logger'

const TOKEN = /^[a-f0-9]{64}$/i

export default async function handler(req, res) {
  setPrivateApiResponse(res)
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }) }
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Import service is unavailable' })
    const token = String(req.query.token || '')
    if (!TOKEN.test(token)) return res.status(404).json({ error: 'Import link not found' })
    if (!await enforceRateLimit(req, res, { scope: 'tenant-import-view', identifier: getClientIp(req), limit: 60, windowSeconds: 900 })) return

    const { data: link, error } = await supabaseAdmin.from('existing_tenant_import_links')
      .select('id,property_id,is_active,properties!inner(id,name,city,address,is_active)')
      .eq('token', token).maybeSingle()
    if (error) throw error
    if (!link || !link.is_active || !link.properties?.is_active) return res.status(404).json({ error: 'This import link is disabled or invalid' })
    const { data: rooms, error: roomsError } = await supabaseAdmin.from('rooms')
      .select('id,room_number,capacity,current_occupants,monthly_rent')
      .eq('property_id', link.property_id).order('room_number')
    if (roomsError) throw roomsError
    return res.status(200).json({ property: { id: link.properties.id, name: link.properties.name, city: link.properties.city, address: link.properties.address }, rooms: rooms || [] })
  } catch (error) {
    logger.error('Existing tenant import link lookup failed', error, { route: '/api/import/[token]' })
    return res.status(500).json({ error: 'Unable to open this import link. Please try again.' })
  }
}
