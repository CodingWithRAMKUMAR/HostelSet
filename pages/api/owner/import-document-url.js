import { supabaseAdmin } from '../../../lib/supabase'
import { allowPostOnly, requireJson, setPrivateApiResponse } from '../../../lib/server/publicApiSecurity'
import { logger } from '../../../lib/logger'

const COOKIE_NAME = 'hostelset_access_token'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FIELD_MAP = { id_proof: 'id_proof', photo: 'profile_photo', profile_photo: 'profile_photo' }

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } }

function readCookie(req, name) {
  const cookies = String(req.headers.cookie || '').split(';')
  const match = cookies.map(item => item.trim()).find(item => item.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : ''
}

export default async function handler(req, res) {
  setPrivateApiResponse(res)
  if (!allowPostOnly(req, res) || !requireJson(req, res)) return
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Document service is unavailable' })

    const token = readCookie(req, COOKIE_NAME)
    if (!token || token.length > 8192) return res.status(401).json({ error: 'Authentication required' })
    const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !auth?.user) return res.status(401).json({ error: 'Authentication required' })

    const { importId, field } = req.body || {}
    const storageField = FIELD_MAP[field]
    if (!UUID.test(String(importId || '')) || !storageField) return res.status(400).json({ error: 'Invalid document request' })

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role,is_active')
      .eq('id', auth.user.id)
      .single()
    if (profileError || !profile?.is_active || !['owner', 'admin'].includes(profile.role)) return res.status(403).json({ error: 'Not authorized' })

    const { data: importRecord, error: importError } = await supabaseAdmin
      .from('existing_tenant_imports')
      .select('id,property_id,status,id_proof,profile_photo')
      .eq('id', importId)
      .eq('status', 'approved')
      .single()
    if (importError || !importRecord) return res.status(404).json({ error: 'Document not found' })

    if (profile.role !== 'admin') {
      const { data: property, error: propertyError } = await supabaseAdmin
        .from('properties')
        .select('owner_id')
        .eq('id', importRecord.property_id)
        .single()
      if (propertyError || property?.owner_id !== auth.user.id) return res.status(403).json({ error: 'Not authorized' })
    }

    const objectPath = importRecord[storageField]
    if (!objectPath || !objectPath.startsWith(`${importRecord.property_id}/imports/`) || objectPath.includes('..')) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const { data, error } = await supabaseAdmin.storage.from('tenant-documents').createSignedUrl(objectPath, 300)
    if (error || !data?.signedUrl) throw error || new Error('Signed URL was not returned')
    return res.status(200).json({ signedUrl: data.signedUrl })
  } catch (error) {
    logger.error('Existing tenant import document signing failed', error, { route: '/api/owner/import-document-url' })
    return res.status(500).json({ error: 'Unable to open document. Please try again.' })
  }
}
