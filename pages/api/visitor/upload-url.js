import crypto from 'crypto'
import { supabaseAdmin } from '../../../lib/supabase'
import { allowPostOnly, enforceRateLimit, getClientIp, requireJson, setPrivateApiResponse } from '../../../lib/server/publicApiSecurity'

const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } }

export default async function handler(req, res) {
  setPrivateApiResponse(res)
  if (!allowPostOnly(req, res) || !requireJson(req, res)) return
  if (!supabaseAdmin) return res.status(503).json({ error: 'Upload service unavailable' })
  const ip = getClientIp(req)
  if (!await enforceRateLimit(req, res, { scope: 'visitor-upload-ip', identifier: ip, limit: 12, windowSeconds: 900 })) return
  const { propertyId, category, contentType, size } = req.body || {}
  if (!UUID.test(String(propertyId || '')) || !['identity', 'photos', 'payments'].includes(category) || !ALLOWED[contentType]) {
    return res.status(400).json({ error: 'Invalid upload request' })
  }
  if (!Number.isSafeInteger(Number(size)) || Number(size) < 1 || Number(size) > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'File must be under 5MB' })
  }
  if (category !== 'identity' && contentType === 'application/pdf') return res.status(400).json({ error: 'An image is required' })
  if (!await enforceRateLimit(req, res, { scope: 'visitor-upload-property', identifier: `${ip}:${propertyId}`, limit: 9, windowSeconds: 900 })) return
  const { data: property, error: propertyError } = await supabaseAdmin.from('properties').select('id').eq('id', propertyId).eq('is_active', true).maybeSingle()
  if (propertyError) return res.status(503).json({ error: 'Upload service temporarily unavailable' })
  if (!property) return res.status(404).json({ error: 'Property not found' })
  const path = `${propertyId}/${category}/${crypto.randomUUID()}.${ALLOWED[contentType]}`
  const { data, error } = await supabaseAdmin.storage.from('tenant-documents').createSignedUploadUrl(path)
  if (error) return res.status(502).json({ error: 'Unable to prepare upload' })
  return res.status(200).json({ path, token: data.token })
}
