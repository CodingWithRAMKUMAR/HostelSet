const { calculateCanonicalRentDue, formatRentDueLabel } = require('./rentDue')

const ACTIVE_TENANT_STATUSES = new Set(['active', 'notice_period', 'payment_pending'])
const UNPAID_RENT_STATUSES = new Set(['overdue', 'due_today', 'due_soon', 'upcoming', 'pending_confirmation'])

function isActiveTenant(tenant) {
  return ACTIVE_TENANT_STATUSES.has(tenant?.status || 'active')
}

function categoryForCanonicalStatus(status, active) {
  if (!active) return 'inactive'
  if (status === 'paid') return 'paid'
  if (status === 'pending_confirmation') return 'pending_confirmation'
  if (status === 'overdue' || status === 'due_today') return 'due'
  if (status === 'due_soon' || status === 'upcoming') return 'upcoming'
  return 'unknown'
}

function enrichTenantRentStatus(tenant, payments = [], now = new Date()) {
  const due = tenant?.rentSummary || tenant?.dueStatus || calculateCanonicalRentDue(tenant, payments, now)
  const days = due?.daysUntilDue == null ? NaN : Number(due.daysUntilDue)
  const active = isActiveTenant(tenant) && due?.status !== 'inactive'
  const category = categoryForCanonicalStatus(due?.status, active)
  const oldestUnpaidCycle = due?.oldestUnpaidCycle || (due?.dueDate ? {
    index: due?.cycleIndex ?? due?.paidPeriods ?? null,
    dueDate: due.dueDate,
    dueAmount: due?.dueAmount ?? null,
    paidAmount: due?.paidAmountForOpenCycle ?? null,
  } : null)
  const dueAmount = category === 'paid' || category === 'inactive' ? 0 : Number(due?.dueAmount || 0)

  return {
    ...due,
    dueAmount,
    category,
    bucket: category,
    label: formatRentDueLabel(due),
    oldestUnpaidCycle,
    isFullyUpToDate: category === 'paid',
    isActive: active,
    currentCyclePaid: category === 'paid',
    isPaidCurrentCycle: category === 'paid',
    isDue: category === 'due',
    isUpcoming: category === 'upcoming',
    isPendingConfirmation: category === 'pending_confirmation',
    hasUnpaidRent: active && UNPAID_RENT_STATUSES.has(due?.status) && dueAmount > 0,
    overdueDays: Number.isFinite(days) && days < 0 ? Math.abs(days) : 0,
    upcomingDays: Number.isFinite(days) && days > 0 ? days : 0,
  }
}

const classifyTenantRent = enrichTenantRentStatus

function summarizeTenantRentStatuses(tenants = []) {
  return tenants.reduce((summary, tenant) => {
    const rent = tenant.rentSummary?.category ? tenant.rentSummary : enrichTenantRentStatus(tenant)
    if (!rent.isActive) return summary
    summary.total += 1
    summary.pendingAmount += rent.hasUnpaidRent ? Number(rent.dueAmount || 0) : 0
    if (rent.category === 'paid') summary.paid += 1
    if (rent.category === 'due') summary.due += 1
    if (rent.category === 'upcoming') summary.upcoming += 1
    if (rent.category === 'pending_confirmation') summary.pending_confirmation += 1
    return summary
  }, { paid: 0, due: 0, upcoming: 0, pending_confirmation: 0, pendingAmount: 0, total: 0 })
}

function getTenantRentCounts(tenants = []) {
  const summary = summarizeTenantRentStatuses(tenants)
  return {
    all: summary.total,
    paid: summary.paid,
    due: summary.due,
    upcoming: summary.upcoming,
    pending_confirmation: summary.pending_confirmation,
  }
}

function filterTenantsByRentStatus(tenants = [], filter = 'all') {
  const rentFor = (tenant) => tenant.rentSummary?.category ? tenant.rentSummary : enrichTenantRentStatus(tenant)
  if (filter === 'all') return tenants.filter(tenant => rentFor(tenant).isActive)
  return tenants.filter(tenant => rentFor(tenant).category === filter)
}

const filterTenantsByRentBucket = filterTenantsByRentStatus

module.exports = {
  ACTIVE_TENANT_STATUSES,
  UNPAID_RENT_STATUSES,
  classifyTenantRent,
  enrichTenantRentStatus,
  filterTenantsByRentBucket,
  filterTenantsByRentStatus,
  getTenantRentCounts,
  isActiveTenant,
  summarizeTenantRentStatuses,
}
