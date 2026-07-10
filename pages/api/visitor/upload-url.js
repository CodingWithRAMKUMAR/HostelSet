import crypto from 'crypto'
import { supabaseAdmin } from '../../../lib/server/supabaseAdmin'
import { allowPostOnly, enforceRateLimit, getClientIp, requireJson, setPrivateApiResponse } from '../../../lib/server/publicApiSecurity'
import { logger } from '../../../lib/logger'

const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } }

async function processUploadRequest(req, res) {
  setPrivateApiResponse(res)
  if (!allowPostOnly(req, res) || !requireJson(req, res)) return
  if (!supabaseAdmin) {
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Upload service unavailable'
      : 'Upload service unavailable: missing SUPABASE_SERVICE_ROLE_KEY'
    return res.status(503).json({ error: errorMessage })
  }

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
  if (propertyError) {
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Upload service temporarily unavailable'
      : `Upload service temporarily unavailable: ${propertyError.message}`
    return res.status(503).json({ error: errorMessage })
  }
  if (!property) return res.status(404).json({ error: 'Property not found' })

  const path = `${propertyId}/${category}/${crypto.randomUUID()}.${ALLOWED[contentType]}`
  const { data, error } = await supabaseAdmin.storage.from('tenant-documents').createSignedUploadUrl(path)
  if (error) {
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Unable to prepare upload'
      : `Unable to prepare upload: ${error.message}`
    return res.status(502).json({ error: errorMessage })
  }
  return res.status(200).json({ path, token: data.token })
}

export default async function handler(req, res) {
  try {
    return await processUploadRequest(req, res)
  } catch (error) {
    logger.error('Visitor upload URL failure', error, { route: '/api/visitor/upload-url' })
    if (res.headersSent) return res.end()
    setPrivateApiResponse(res)
    return res.status(500).json({ error: 'Unable to prepare upload. Please try again.' })
  }
}
