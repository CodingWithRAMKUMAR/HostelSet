import crypto from 'crypto'
import { supabaseAdmin } from '../../../lib/supabase'

const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabaseAdmin) return res.status(503).json({ error: 'Upload service unavailable' })
  const { propertyId, category, contentType, size } = req.body || {}
  if (!propertyId || !['identity', 'photos', 'payments'].includes(category) || !ALLOWED[contentType]) {
    return res.status(400).json({ error: 'Invalid upload request' })
  }
  if (!Number.isFinite(Number(size)) || Number(size) < 1 || Number(size) > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'File must be under 5MB' })
  }
  if (category !== 'identity' && contentType === 'application/pdf') return res.status(400).json({ error: 'An image is required' })
  const { data: property } = await supabaseAdmin.from('properties').select('id').eq('id', propertyId).eq('is_active', true).maybeSingle()
  if (!property) return res.status(404).json({ error: 'Property not found' })
  const path = `${propertyId}/${category}/${crypto.randomUUID()}.${ALLOWED[contentType]}`
  const { data, error } = await supabaseAdmin.storage.from('tenant-documents').createSignedUploadUrl(path)
  if (error) return res.status(400).json({ error: error.message })
  return res.status(200).json({ path, token: data.token })
}
