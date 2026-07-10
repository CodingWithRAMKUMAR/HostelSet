import { supabaseAdmin } from './supabaseAdmin'

export async function createNotification({
  recipientUserId,
  recipientRole,
  propertyId = null,
  type,
  title,
  message,
  actionUrl = null,
  metadata = null,
}) {
  if (!supabaseAdmin || !recipientUserId || !recipientRole || !type || !title || !message) return null
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({
      recipient_user_id: recipientUserId,
      recipient_role: recipientRole,
      property_id: propertyId,
      type,
      title,
      message,
      action_url: actionUrl,
      metadata,
    })
    .select('id')
    .single()
  if (error) throw error
  return data?.id || null
}

export function createOwnerNotification({ ownerId, propertyId, type, title, message, actionUrl = '/owner/dashboard', metadata = null }) {
  return createNotification({ recipientUserId: ownerId, recipientRole: 'owner', propertyId, type, title, message, actionUrl, metadata })
}

export function createTenantNotification({ tenantUserId, propertyId, type, title, message, actionUrl = '/tenant/dashboard', metadata = null }) {
  return createNotification({ recipientUserId: tenantUserId, recipientRole: 'tenant', propertyId, type, title, message, actionUrl, metadata })
}

export function createAdminNotification({ adminId, type, title, message, actionUrl = '/admin/dashboard', metadata = null }) {
  return createNotification({ recipientUserId: adminId, recipientRole: 'admin', type, title, message, actionUrl, metadata })
}

export async function createPropertyOwnerNotification({ propertyId, type, title, message, actionUrl = '/owner/dashboard', metadata = null }) {
  if (!supabaseAdmin || !propertyId) return null
  const { data: property, error } = await supabaseAdmin.from('properties').select('owner_id').eq('id', propertyId).maybeSingle()
  if (error) throw error
  if (!property?.owner_id) return null
  return createOwnerNotification({ ownerId: property.owner_id, propertyId, type, title, message, actionUrl, metadata })
}
