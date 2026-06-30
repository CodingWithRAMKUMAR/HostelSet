import crypto from 'crypto'
import { supabaseAdmin } from '../../../lib/supabase'
import { cleanPhoneNumber } from '../../../lib/utils'

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
const attempts = new Map()

function rateLimited(ip) {
  const now = Date.now()
  const recent = (attempts.get(ip) || []).filter(time => now - time < 15 * 60 * 1000)
  recent.push(now)
  attempts.set(ip, recent)
  return recent.length > 8
}

function decodeFile(file, label, imageOnly = false) {
  if (!file?.data || !file?.type) throw new Error(`${label} is required`)
  if (!ALLOWED.has(file.type) || (imageOnly && file.type === 'application/pdf')) {
    throw new Error(`${label} has an unsupported file type`)
  }
  const match = file.data.match(/^data:([^;]+);base64,(.+)$/)
  if (!match || match[1] !== file.type) throw new Error(`${label} is invalid`)
  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length || buffer.length > MAX_FILE_SIZE) throw new Error(`${label} must be under 5MB`)
  return buffer
}

function extension(type) {
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' })[type]
}

async function uploadPrivate(file, folder, label, imageOnly = false) {
  const buffer = decodeFile(file, label, imageOnly)
  const path = `${folder}/${crypto.randomUUID()}.${extension(file.type)}`
  const { error } = await supabaseAdmin.storage.from('tenant-documents').upload(path, buffer, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  return path
}

async function removeFiles(paths) {
  if (paths.length) await supabaseAdmin.storage.from('tenant-documents').remove(paths)
}

function privatePath(path, propertyId, category, label) {
  const value = String(path || '')
  if (!value.startsWith(`${propertyId}/${category}/`) || value.includes('..')) throw new Error(`${label} upload is invalid`)
  return value
}

async function verifyPrivateObject(path, label) {
  const slash = path.lastIndexOf('/')
  const folder = path.slice(0, slash)
  const name = path.slice(slash + 1)
  const { data, error } = await supabaseAdmin.storage.from('tenant-documents').list(folder, { search: name, limit: 2 })
  const object = data?.find(item => item.name === name)
  if (error || !object || Number(object.metadata?.size || 0) < 1 || Number(object.metadata?.size || 0) > MAX_FILE_SIZE) {
    throw new Error(`${label} upload was not completed`)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabaseAdmin) return res.status(503).json({ error: 'Application service is unavailable' })
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim()
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many attempts. Please try again later.' })

  const uploaded = []
  let createdUserId = null
  try {
    const { kind = 'application', propertyId, roomId, form, files, transactionId, expectedMoveIn } = req.body || {}
    const name = String(form?.name || '').trim().slice(0, 120)
    const email = String(form?.email || '').trim().toLowerCase().slice(0, 254)
    const phone = cleanPhoneNumber(form?.phone)
    const message = String(form?.message || '').trim().slice(0, 2000) || null
    if (!['application', 'prebooking'].includes(kind) || !propertyId || !roomId || !name || !/^\S+@\S+\.\S+$/.test(email) || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: 'Please provide valid application details.' })
    }

    const { data: room, error: roomError } = await supabaseAdmin.from('rooms')
      .select('id, property_id, capacity, current_occupants, monthly_rent, deposit_amount')
      .eq('id', roomId).eq('property_id', propertyId).single()
    if (roomError || !room) return res.status(404).json({ error: 'The selected room is no longer available.' })
    if (kind === 'application' && Number(room.current_occupants || 0) >= Number(room.capacity || 0)) {
      return res.status(409).json({ error: 'This room is full. Please select another room.' })
    }

    const table = kind === 'prebooking' ? 'pre_bookings' : 'applications'
    const [{ data: duplicatePhone }, { data: duplicateEmail }] = await Promise.all([
      supabaseAdmin.from(table).select('id').eq('property_id', propertyId).eq('phone', phone).in('status', ['pending', 'approved']).limit(1),
      supabaseAdmin.from(table).select('id').eq('property_id', propertyId).eq('email', email).in('status', ['pending', 'approved']).limit(1),
    ])
    if (duplicatePhone?.length || duplicateEmail?.length) return res.status(409).json({ error: 'An active request already exists for these details.' })

    const idPath = typeof files?.idProof === 'string' ? privatePath(files.idProof, propertyId, 'identity', 'ID proof') : await uploadPrivate(files?.idProof, `${propertyId}/identity`, 'ID proof')
    uploaded.push(idPath)
    const photoPath = typeof files?.photo === 'string' ? privatePath(files.photo, propertyId, 'photos', 'Photo') : await uploadPrivate(files?.photo, `${propertyId}/photos`, 'Photo', true)
    uploaded.push(photoPath)
    const paymentPath = typeof files?.payment === 'string' ? privatePath(files.payment, propertyId, 'payments', 'Payment screenshot') : await uploadPrivate(files?.payment, `${propertyId}/payments`, 'Payment screenshot', true)
    uploaded.push(paymentPath)
    await Promise.all([
      verifyPrivateObject(idPath, 'ID proof'), verifyPrivateObject(photoPath, 'Photo'), verifyPrivateObject(paymentPath, 'Payment screenshot'),
    ])

    if (kind === 'prebooking') {
      if (!expectedMoveIn || Number.isNaN(Date.parse(expectedMoveIn))) throw new Error('A valid move-in date is required')
      const { data: settings } = await supabaseAdmin.from('owner_settings').select('pre_booking_fee, upi_id').eq('property_id', propertyId).maybeSingle()
      if (!settings?.upi_id) throw new Error('Owner payment details are not configured')
      const { error } = await supabaseAdmin.from('pre_bookings').insert({
        property_id: propertyId, room_id: roomId, user_id: null, name, phone, email, message,
        expected_move_in_date: expectedMoveIn, id_proof: idPath, photo: photoPath,
        status: 'pending', payment_status: 'pending', pre_booking_fee_amount: Number(settings.pre_booking_fee || 0),
        payment_screenshot: paymentPath, payment_transaction_id: String(transactionId || '').trim().slice(0, 120) || null,
      })
      if (error) throw error
    } else {
      const { data: settings } = await supabaseAdmin.from('owner_settings').select('upi_id').eq('property_id', propertyId).maybeSingle()
      if (!settings?.upi_id) throw new Error('Owner payment details are not configured')
      const [{ data: byPhone }, { data: byEmail }] = await Promise.all([
        supabaseAdmin.from('users').select('id, email').eq('phone', phone).limit(1),
        supabaseAdmin.from('users').select('id, phone').eq('email', email).limit(1),
      ])
      if (byPhone?.[0] && byEmail?.[0] && byPhone[0].id !== byEmail[0].id) throw new Error('The phone and email belong to different accounts')
      let userId = byPhone?.[0]?.id || byEmail?.[0]?.id
      if (!userId) {
        const password = `${crypto.randomBytes(18).toString('base64url')}Aa1!`
        const { data: auth, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email, password, email_confirm: true, user_metadata: { full_name: name, phone, role: 'tenant' },
        })
        if (authError) throw authError
        userId = auth.user.id
        createdUserId = userId
        const { error: userError } = await supabaseAdmin.from('users').upsert({ id: userId, email, full_name: name, phone, role: 'tenant', is_active: true })
        if (userError) throw userError
      }
      const deposit = Math.max(0, Number(room.deposit_amount || 0))
      const { error } = await supabaseAdmin.from('applications').insert({
        user_id: userId, property_id: propertyId, room_id: roomId, name, phone, email, message,
        status: 'pending', id_proof: idPath, photo: photoPath, payment_screenshot: paymentPath,
        payment_transaction_id: String(transactionId || '').trim().slice(0, 120) || null,
        payment_amount: deposit,
      })
      if (error) throw error
    }

    return res.status(201).json({ success: true })
  } catch (error) {
    await removeFiles(uploaded)
    if (createdUserId) await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch(() => {})
    console.error('Visitor submission failed:', error)
    const conflict = error?.code === '23505'
    return res.status(conflict ? 409 : 400).json({ error: conflict ? 'An active request already exists.' : (error.message || 'Submission failed') })
  }
}
