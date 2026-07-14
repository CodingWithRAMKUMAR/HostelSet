const { calculateCanonicalRentDue, formatRentDueLabel } = require('./rentDue')

const ACTIVE_TENANT_STATUSES = new Set(['active', 'notice_period', 'payment_pending'])

function isActiveTenant(tenant) {
  return ACTIVE_TENANT_STATUSES.has(tenant?.status || 'active')
}

function enrichTenantRentStatus(tenant, payments = [], now = new Date()) {
  const due = tenant?.dueStatus || calculateCanonicalRentDue(tenant, payments, now)
  const days = due?.daysUntilDue == null ? NaN : Number(due.daysUntilDue)
  const active = isActiveTenant(tenant)
  let category = active ? 'unknown' : 'inactive'

  if (active) {
    if (Number.isFinite(days) && days <= 0) category = 'due'
    else if (Number.isFinite(days) && days <= 3) category = 'upcoming'
    else if (Number.isFinite(days) || due?.paidForCurrentCycle || due?.status === 'paid') category = 'paid'
  }

  const label = category === 'paid' ? 'Paid' : formatRentDueLabel(due)
  const oldestUnpaidCycle = due?.oldestUnpaidCycle || (due?.dueDate ? {
    index: due?.cycleIndex ?? due?.paidPeriods ?? null,
    dueDate: due.dueDate,
    dueAmount: due?.dueAmount ?? null,
    paidAmount: due?.paidAmountForOpenCycle ?? null,
  } : null)
  return {
    ...due,
    category,
    bucket: category,
    label,
    oldestUnpaidCycle,
    isFullyUpToDate: category === 'paid',
    isActive: active,
    currentCyclePaid: category === 'paid',
    isPaidCurrentCycle: category === 'paid',
    isDue: category === 'due',
    isUpcoming: category === 'upcoming',
    overdueDays: Number.isFinite(days) && days < 0 ? Math.abs(days) : 0,
    upcomingDays: Number.isFinite(days) && days > 0 ? days : 0,
  }
}

const classifyTenantRent = enrichTenantRentStatus

function summarizeTenantRentStatuses(tenants = []) {
  return tenants.reduce((summary, tenant) => {
    const rent = tenant.rentSummary || enrichTenantRentStatus(tenant)
    if (!rent.isActive) return summary
    summary.total += 1
    if (rent.category === 'paid') summary.paid += 1
    if (rent.category === 'due') summary.due += 1
    if (rent.category === 'upcoming') summary.upcoming += 1
    return summary
  }, { paid: 0, due: 0, upcoming: 0, total: 0 })
}

function getTenantRentCounts(tenants = []) {
  const summary = summarizeTenantRentStatuses(tenants)
  return { all: summary.total, paid: summary.paid, due: summary.due, upcoming: summary.upcoming }
}

function filterTenantsByRentStatus(tenants = [], filter = 'all') {
  if (filter === 'all') return tenants.filter(tenant => (tenant.rentSummary || enrichTenantRentStatus(tenant)).isActive)
  return tenants.filter(tenant => (tenant.rentSummary || enrichTenantRentStatus(tenant)).category === filter)
}

const filterTenantsByRentBucket = filterTenantsByRentStatus

module.exports = {
  ACTIVE_TENANT_STATUSES,
  classifyTenantRent,
  enrichTenantRentStatus,
  filterTenantsByRentBucket,
  filterTenantsByRentStatus,
  getTenantRentCounts,
  summarizeTenantRentStatuses,
}
