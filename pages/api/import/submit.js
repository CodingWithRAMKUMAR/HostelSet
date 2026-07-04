import { supabaseAdmin } from '../../../lib/supabase'
import { cleanPhoneNumber } from '../../../lib/utils'
import { allowPostOnly, enforceRateLimit, getClientIp, requireJson, setPrivateApiResponse } from '../../../lib/server/publicApiSecurity'
import { logger } from '../../../lib/logger'

const TOKEN = /^[a-f0-9]{64}$/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
export const config = { api: { bodyParser: { sizeLimit: '32kb' } } }

class PublicImportError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

function readField(body, primary, fallback) {
  return body[primary] ?? (fallback ? body[fallback] : undefined)
}

function invalid(res, reason, context = {}) {
  logger.info('Existing tenant import validation failed', { reason, ...context })
  return res.status(400).json({ error: reason })
}

function safeDatabaseError(error) {
  if (error?.code === '23505') {
    return { status: 409, message: 'A tenant with this phone or email is already submitted for this property.' }
  }
  if (error?.code === '23502' && error?.message?.includes('"user_id"')) {
    return { status: 503, message: 'Import submissions are temporarily unavailable. Please try again shortly.' }
  }
  if (error?.code === '23502') {
    return { status: 400, message: 'Please provide all required tenant details.' }
  }
  if (error?.code === '23503') {
    return { status: 400, message: 'The selected room or property is no longer available. Please refresh and try again.' }
  }
  if (error?.code === '23514') {
    return { status: 400, message: 'Please check the submitted tenant details and try again.' }
  }
  if (error?.code === '42501') {
    return { status: 403, message: 'This import request is not authorized.' }
  }
  return null
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

async function verifyObject(path, prefix, imageOnly, label) {
  if (!path?.startsWith(prefix) || path.includes('..')) throw new PublicImportError(`${label} upload is invalid.`)
  const split = path.lastIndexOf('/')
  const { data, error } = await supabaseAdmin.storage.from('tenant-documents').list(path.slice(0, split), { search: path.slice(split + 1), limit: 2 })
  const object = data?.find(item => item.name === path.slice(split + 1))
  const type = object?.metadata?.mimetype || object?.metadata?.contentType
  const size = Number(object?.metadata?.size || 0)
  if (error || !object || !TYPES.has(type) || (imageOnly && type === 'application/pdf') || size < 1 || size > 5 * 1024 * 1024) throw new PublicImportError(`${label} upload was not completed. Please upload it again.`)
}

export default async function handler(req, res) {
  setPrivateApiResponse(res)
  if (!allowPostOnly(req, res) || !requireJson(req, res)) return
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Import service is unavailable' })
    const body = req.body || {}
    const token = String(body.token || '')
    const fullName = String(readField(body, 'full_name', 'fullName') || '').trim().slice(0, 120)
    const email = String(body.email || '').trim().toLowerCase().slice(0, 254)
    const phone = cleanPhoneNumber(body.phone)
    const emergencyContact = cleanPhoneNumber(readField(body, 'emergency_contact', 'emergencyContact'))
    const roomId = String(readField(body, 'room_id', 'roomId') || '')
    const currentRent = Number(readField(body, 'current_rent_amount', 'currentRent'))
    const moveInDate = String(readField(body, 'move_in_date', 'moveInDate') || '')
    const occupation = String(body.occupation || '')
    const notes = String(body.notes || '').trim().slice(0, 2000) || null
    const idProof = String(readField(body, 'id_proof_path', 'idProof') || '')
    const profilePhoto = String(readField(body, 'profile_photo_path', 'profilePhoto') || '')

    if (!TOKEN.test(token)) return invalid(res, 'This import link is disabled or invalid.', { field: 'token' })
    if (!fullName) return invalid(res, 'Please enter the tenant name.', { field: 'full_name' })
    if (!/^\S+@\S+\.\S+$/.test(email)) return invalid(res, 'Please enter a valid email address.', { field: 'email' })
    if (!/^\d{10}$/.test(phone)) return invalid(res, 'Please enter a valid 10-digit phone number.', { field: 'phone' })
    if (!/^\d{10}$/.test(emergencyContact)) return invalid(res, 'Please enter a valid 10-digit emergency contact number.', { field: 'emergency_contact' })
    if (!UUID.test(roomId)) return invalid(res, 'Please select a room.', { field: 'room_id' })
    if (!Number.isFinite(currentRent) || currentRent <= 0 || currentRent > 1000000) return invalid(res, 'Please enter a valid current rent amount.', { field: 'current_rent_amount' })
    if (!isValidDateString(moveInDate) || moveInDate > todayIsoDate()) return invalid(res, 'Please select a valid move-in date.', { field: 'move_in_date' })
    if (!['student', 'employee', 'other'].includes(occupation)) return invalid(res, 'Please select an occupation.', { field: 'occupation' })
    if (!idProof) return invalid(res, 'Please upload ID proof.', { field: 'id_proof_path' })
    if (!profilePhoto) return invalid(res, 'Please upload profile photo.', { field: 'profile_photo_path' })

    const ip = getClientIp(req)
    if (!await enforceRateLimit(req, res, { scope: 'tenant-import-submit-ip', identifier: ip, limit: 8, windowSeconds: 900 })) return
    if (!await enforceRateLimit(req, res, { scope: 'tenant-import-submit-identity', identifier: `${token}:${email}:${phone}`, limit: 3, windowSeconds: 3600 })) return

    const { data: link, error: linkError } = await supabaseAdmin.from('existing_tenant_import_links').select('id,property_id,is_active,properties!inner(is_active)').eq('token', token).maybeSingle()
    if (linkError) throw linkError
    if (!link?.is_active || !link.properties?.is_active) return res.status(404).json({ error: 'This import link is disabled or invalid.' })
    const { data: room, error: roomError } = await supabaseAdmin.from('rooms').select('id,room_number').eq('id', roomId).eq('property_id', link.property_id).maybeSingle()
    if (roomError) throw roomError
    if (!room) return res.status(404).json({ error: 'The selected room does not exist for this property.' })
    const [{ data: phoneDuplicate }, { data: emailDuplicate }] = await Promise.all([
      supabaseAdmin.from('existing_tenant_imports').select('id').eq('property_id', link.property_id).eq('phone', phone).in('status', ['pending_owner_review', 'approved']).limit(1),
      supabaseAdmin.from('existing_tenant_imports').select('id').eq('property_id', link.property_id).eq('email', email).in('status', ['pending_owner_review', 'approved']).limit(1),
    ])
    if (phoneDuplicate?.length || emailDuplicate?.length) return res.status(409).json({ error: 'A tenant with this phone or email is already submitted for this property.' })

    await Promise.all([
      verifyObject(idProof, `${link.property_id}/imports/identity/`, false, 'ID proof'),
      verifyObject(profilePhoto, `${link.property_id}/imports/photos/`, true, 'Profile photo'),
    ])

    const { error: insertError } = await supabaseAdmin.from('existing_tenant_imports').insert({
      link_id: link.id, property_id: link.property_id, room_id: room.id, user_id: null,
      full_name: fullName, phone, email, room_number: room.room_number, current_rent: currentRent,
      move_in_date: moveInDate, emergency_contact: emergencyContact, occupation,
      id_proof: idProof, profile_photo: profilePhoto, notes, status: 'pending_owner_review',
    })
    if (insertError) {
      logger.error('Existing tenant import insert failed', insertError, {
        route: '/api/import/submit',
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      })
      throw insertError
    }
    return res.status(201).json({ success: true, message: 'Your details were submitted. The owner will review and approve your account. You will receive an invite email after approval.' })
  } catch (error) {
    logger.error('Existing tenant import submission failed', error, { route: '/api/import/submit' })
    if (error instanceof PublicImportError) return res.status(error.status).json({ error: error.message })
    const databaseError = safeDatabaseError(error)
    if (databaseError) return res.status(databaseError.status).json({ error: databaseError.message })
    return res.status(400).json({ error: 'Submission failed. Please try again.' })
  }
}
