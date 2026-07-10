import crypto from 'crypto'
import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { allowPostOnly, enforceRateLimit, getClientIp, requireJson, setPrivateApiResponse } from '../../../lib/server/publicApiSecurity'
import { logger } from '../../../lib/logger'

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }
const TOKEN = /^[a-f0-9]{64}$/i
export const config = { api: { bodyParser: { sizeLimit: '16kb' } } }

export default async function handler(req, res) {
  setPrivateApiResponse(res)
  if (!allowPostOnly(req, res) || !requireJson(req, res)) return
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Upload service is unavailable' })
    const { token, category, contentType, size } = req.body || {}
    if (!TOKEN.test(String(token || '')) || !['identity', 'photos'].includes(category) || !TYPES[contentType]) return res.status(400).json({ error: 'Invalid upload request' })
    if (category === 'photos' && contentType === 'application/pdf') return res.status(400).json({ error: 'Profile photo must be an image' })
    if (!Number.isSafeInteger(Number(size)) || Number(size) < 1 || Number(size) > 5 * 1024 * 1024) return res.status(400).json({ error: 'File must be under 5MB' })
    const ip = getClientIp(req)
    if (!await enforceRateLimit(req, res, { scope: 'tenant-import-upload-ip', identifier: ip, limit: 16, windowSeconds: 900 })) return
    if (!await enforceRateLimit(req, res, { scope: 'tenant-import-upload-token', identifier: `${ip}:${token}`, limit: 12, windowSeconds: 900 })) return
    const { data: link, error } = await supabaseAdmin.from('existing_tenant_import_links').select('property_id,is_active,properties!inner(is_active)').eq('token', token).maybeSingle()
    if (error) throw error
    if (!link?.is_active || !link.properties?.is_active) return res.status(404).json({ error: 'This import link is disabled or invalid' })
    const path = `${link.property_id}/imports/${category}/${crypto.randomUUID()}.${TYPES[contentType]}`
    const { data, error: uploadError } = await supabaseAdmin.storage.from('tenant-documents').createSignedUploadUrl(path)
    if (uploadError) throw uploadError
    return res.status(200).json({ path, token: data.token })
  } catch (error) {
    logger.error('Existing tenant import upload preparation failed', error)
    return res.status(500).json({ error: 'Unable to prepare upload. Please try again.' })
  }
}
