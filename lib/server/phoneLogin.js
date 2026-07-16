const ACTIVE_TENANT_STATUSES = new Set(['active', 'notice_period', 'payment_pending'])

function normalizeIndianPhone(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (/^[6-9]\d{9}$/.test(digits)) return digits
  if (/^91[6-9]\d{9}$/.test(digits)) return digits.slice(2)
  if (/^0[6-9]\d{9}$/.test(digits)) return digits.slice(1)
  return ''
}

function phoneLoginVariants(canonicalPhone) {
  if (!/^[6-9]\d{9}$/.test(canonicalPhone || '')) return []
  return [canonicalPhone, `91${canonicalPhone}`, `+91${canonicalPhone}`]
}

function uniqueById(rows) {
  const seen = new Set()
  return (rows || []).filter(row => {
    const id = row?.id || row?.user_id || row?.email
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function genericResolutionFailure(reason, status = 404) {
  return { ok: false, status, reason, publicMessage: 'No account found with this phone number.' }
}

function uniqueActiveUser(rows) {
  const active = uniqueById(rows).filter(row => row?.email && row.is_active !== false)
  if (active.length === 1) return { ok: true, user: active[0] }
  if (active.length > 1) return genericResolutionFailure('duplicate_active_users')
  if ((rows || []).length > 0) return genericResolutionFailure('inactive_or_email_missing_user')
  return genericResolutionFailure('no_user_match')
}

async function resolvePhoneLoginEmail({ supabase, phone, logger }) {
  const canonicalPhone = normalizeIndianPhone(phone)
  if (!canonicalPhone) return genericResolutionFailure('invalid_phone')

  const variants = phoneLoginVariants(canonicalPhone)
  const { data: userRows, error: userError } = await supabase
    .from('users')
    .select('id,email,phone,is_active,role')
    .in('phone', variants)
    .limit(6)
  if (userError) throw userError

  const userResult = uniqueActiveUser(userRows || [])
  if (userResult.ok) {
    return { ok: true, email: userResult.user.email, canonicalPhone, source: 'users' }
  }
  if (userResult.reason === 'duplicate_active_users') {
    logger?.warn?.('Phone login rejected because multiple active users matched', {
      reason: userResult.reason,
      matchedCount: uniqueById(userRows || []).length,
    })
    return userResult
  }

  const { data: tenantRows, error: tenantError } = await supabase
    .from('tenants')
    .select('id,user_id,phone,status,email,name')
    .in('phone', variants)
    .limit(8)
  if (tenantError) throw tenantError

  const activeTenants = uniqueById(tenantRows || [])
    .filter(row => row?.user_id && ACTIVE_TENANT_STATUSES.has(row.status))
  const linkedUserIds = [...new Set(activeTenants.map(row => row.user_id))]

  if (linkedUserIds.length !== 1) {
    const reason = linkedUserIds.length > 1
      ? 'duplicate_active_tenants'
      : ((tenantRows || []).length ? 'inactive_or_unlinked_tenant' : 'no_tenant_match')
    if (linkedUserIds.length > 1) {
      logger?.warn?.('Phone login rejected because multiple active tenants matched', {
        reason,
        matchedCount: activeTenants.length,
      })
    }
    return genericResolutionFailure(reason)
  }

  const { data: linkedUser, error: linkedUserError } = await supabase
    .from('users')
    .select('id,email,is_active,role')
    .eq('id', linkedUserIds[0])
    .maybeSingle()
  if (linkedUserError) throw linkedUserError

  if (!linkedUser?.email || linkedUser.is_active === false) {
    return genericResolutionFailure('inactive_or_missing_linked_user')
  }

  return { ok: true, email: linkedUser.email, canonicalPhone, source: 'tenants' }
}

module.exports = {
  ACTIVE_TENANT_STATUSES,
  normalizeIndianPhone,
  phoneLoginVariants,
  resolvePhoneLoginEmail,
}
