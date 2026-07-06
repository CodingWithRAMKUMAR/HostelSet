import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../../../lib/supabase'
import { allowPostOnly, requireJson, setPrivateApiResponse } from '../../../lib/server/publicApiSecurity'
import { logger } from '../../../lib/logger'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } }

async function rejectDeletedRequest(table, match, deletedBy, timestamp) {
  if (!Object.values(match).every(Boolean)) return
  const { data: rows, error: readError } = await supabaseAdmin
    .from(table)
    .select('id,status')
    .match(match)
    .is('deleted_at', null)
    .limit(50)
  if (readError) throw readError
  if (!rows?.length) return

  const ids = rows.map(row => row.id)
  const { error } = await supabaseAdmin
    .from(table)
    .update({
      status: 'rejected',
      deleted_at: timestamp,
      deleted_by: deletedBy,
      source_status: rows[0]?.status || null,
      ...(table === 'existing_tenant_imports' ? { rejection_reason: 'Tenant account permanently removed' } : {}),
    })
    .in('id', ids)
  if (error) throw error
}

export default async function handler(req, res) {
  setPrivateApiResponse(res)
  if (!allowPostOnly(req, res) || !requireJson(req, res)) return
  if (!supabaseAdmin) return res.status(503).json({ error: 'Admin delete service is unavailable' })

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Authentication required' })
  const { tenantId } = req.body || {}
  if (!UUID.test(String(tenantId || ''))) return res.status(400).json({ error: 'Invalid tenant id' })

  const caller = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { data: auth, error: authError } = await caller.auth.getUser(token)
    if (authError || !auth?.user) return res.status(401).json({ error: 'Session expired. Please log in again.' })

    const { data: admin, error: adminError } = await supabaseAdmin
      .from('users')
      .select('id,role,is_active')
      .eq('id', auth.user.id)
      .single()
    if (adminError || admin?.role !== 'admin' || !admin?.is_active) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id,user_id,property_id,room_id,status,name,phone,email')
      .eq('id', tenantId)
      .single()
    if (tenantError || !tenant) return res.status(404).json({ error: 'Tenant not found' })

    const now = new Date().toISOString()
    const snapshot = {
      snapshot_name: tenant.name || null,
      snapshot_phone: tenant.phone || null,
      snapshot_email: tenant.email || null,
      tenant_deleted_at: now,
    }

    const [{ error: paymentError }, { error: rentError }] = await Promise.all([
      supabaseAdmin.from('payment_history').update(snapshot).eq('tenant_id', tenant.id),
      supabaseAdmin.from('rent_records').update(snapshot).eq('tenant_id', tenant.id),
    ])
    if (paymentError) throw paymentError
    if (rentError) throw rentError

    if (tenant.status !== 'inactive') {
      const { data: room, error: roomError } = await supabaseAdmin
        .from('rooms')
        .select('id,current_occupants,capacity')
        .eq('id', tenant.room_id)
        .single()
      if (roomError) throw roomError

      const nextOccupants = Math.max(0, Number(room.current_occupants || 0) - 1)
      const [{ error: tenantArchiveError }, { error: roomUpdateError }] = await Promise.all([
        supabaseAdmin.from('tenants').update({
          status: 'inactive',
          check_out_requested: false,
          notice_period_start: null,
          notice_period_end: null,
          archived_at: now,
          updated_at: now,
        }).eq('id', tenant.id),
        supabaseAdmin.from('rooms').update({
          current_occupants: nextOccupants,
          status: nextOccupants >= Number(room.capacity || 0) ? 'occupied' : 'vacant',
          updated_at: now,
        }).eq('id', tenant.room_id),
      ])
      if (tenantArchiveError) throw tenantArchiveError
      if (roomUpdateError) throw roomUpdateError
    }

    await Promise.all([
      supabaseAdmin.from('room_change_requests').update({ status: 'rejected', rejection_reason: 'Tenant account permanently removed', processed_at: now, updated_at: now }).eq('tenant_id', tenant.id).eq('status', 'pending'),
      supabaseAdmin.from('check_out_requests').update({ status: 'cancelled', processed_at: now, updated_at: now }).eq('tenant_id', tenant.id).eq('status', 'pending'),
      supabaseAdmin.from('rent_records').update({ status: 'cancelled', updated_at: now }).eq('tenant_id', tenant.id).eq('status', 'unpaid'),
    ])

    await Promise.all([
      rejectDeletedRequest('applications', { property_id: tenant.property_id, phone: tenant.phone }, admin.id, now),
      rejectDeletedRequest('applications', { property_id: tenant.property_id, email: tenant.email }, admin.id, now),
      rejectDeletedRequest('pre_bookings', { property_id: tenant.property_id, phone: tenant.phone }, admin.id, now),
      rejectDeletedRequest('pre_bookings', { property_id: tenant.property_id, email: tenant.email }, admin.id, now),
      rejectDeletedRequest('existing_tenant_imports', { property_id: tenant.property_id, phone: tenant.phone }, admin.id, now),
      rejectDeletedRequest('existing_tenant_imports', { property_id: tenant.property_id, email: tenant.email }, admin.id, now),
    ])

    if (tenant.user_id) {
      const { data: profile } = await supabaseAdmin.from('users').select('role').eq('id', tenant.user_id).maybeSingle()
      if (profile?.role && profile.role !== 'tenant') return res.status(409).json({ error: 'Refusing to delete a non-tenant user account' })

      const { error: detachError } = await supabaseAdmin.from('tenants').update({ user_id: null, updated_at: now }).eq('id', tenant.id)
      if (detachError) throw detachError

      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(tenant.user_id)
      if (authDeleteError) {
        logger.warn('Tenant auth deletion failed; deactivating profile instead', { userId: tenant.user_id, message: authDeleteError.message })
        const { error: deactivateError } = await supabaseAdmin.from('users').update({ is_active: false, updated_at: now }).eq('id', tenant.user_id).eq('role', 'tenant')
        if (deactivateError) throw deactivateError
      } else {
        await supabaseAdmin.from('users').delete().eq('id', tenant.user_id).eq('role', 'tenant')
      }
    }

    return res.status(200).json({ success: true })
  } catch (error) {
    logger.error('Admin tenant permanent delete failed', error, { route: '/api/admin/delete-tenant', tenantId })
    return res.status(400).json({ error: error.message || 'Tenant delete failed' })
  }
}
