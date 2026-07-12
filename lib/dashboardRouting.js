const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CONFIG = {
  owner: {
    views: ['overview','analytics','rooms','tenants','archived-tenants','rent-payments','payment-history','pre-bookings','applications','existing-imports','complaints','vacate','room-change','notices','membership'],
    aliases: { application:'applications',import:'existing-imports',imports:'existing-imports',payment:'rent-payments',rent:'rent-payments',payments:'rent-payments',history:'payment-history',complaint:'complaints','room_change':'room-change',roomChange:'room-change',roomchange:'room-change',notice:'notices','archived-tenant':'archived-tenants' },
    ids: { applications:'application_id','existing-imports':'import_id','rent-payments':'payment_id',complaints:'complaint_id','room-change':'request_id',vacate:'request_id',notices:'notice_id',membership:'membership_id','archived-tenants':'tenant_id' },
  },
  tenant: {
    views: ['overview','requests','roommates','notices','complaints','payments','room-change','vacate'],
    aliases: { payment:'payments','payment-status':'payments',notice:'notices',complaint:'complaints','complaint-update':'complaints','room_change':'room-change',roomChange:'room-change',roomchange:'room-change','room-change-update':'room-change','vacate-update':'vacate' },
    ids: { payments:'payment_id',notices:'notice_id',complaints:'complaint_id','room-change':'request_id',vacate:'request_id' },
  },
  admin: {
    views: ['overview','analytics','global-search','properties','tenants','owners','users','payments','prebookings','applications','approvedapps','complaints','vacate','roomchange','notices','membership'],
    aliases: { dashboard:'overview',search:'global-search',property:'properties',payment:'payments',application:'applications',complaint:'complaints','room-change':'roomchange',room_change:'roomchange',roomChange:'roomchange','vacate-request':'vacate',applicationsApproved:'approvedapps',imports:'overview' },
    ids: { properties:'property_id',membership:'membership_id',payments:'payment_id',applications:'application_id',complaints:'complaint_id',roomchange:'request_id',vacate:'request_id' },
  },
}

function resolveDashboardQuery(role, query = {}) {
  const config = CONFIG[role]
  if (!config) return { view:'overview', recordId:null, recordKey:null }
  const raw = typeof query.tab === 'string' ? query.tab : ''
  const candidate = config.aliases[raw] || raw
  const view = config.views.includes(candidate) ? candidate : 'overview'
  const recordKey = config.ids[view] || null
  const value = recordKey && typeof query[recordKey] === 'string' ? query[recordKey] : null
  return { view, recordKey, recordId: value && UUID.test(value) ? value : null }
}

function resolveOwnerDashboardQuery(query) {
  const result = resolveDashboardQuery('owner', query)
  return { ...result, requestId: result.recordKey === 'request_id' ? result.recordId : null }
}

module.exports = { CONFIG, resolveDashboardQuery, resolveOwnerDashboardQuery }
