const DAY_MS = 86400000

const NON_MONTHLY_RENT_METHODS = new Set([
  'security_deposit',
  'deposit',
  'pre_booking',
  'joining_fee',
  'application_fee',
])

const PENDING_RENT_STATUSES = new Set([
  'payment_pending',
  'pending',
  'pending_confirmation',
  'pending_owner_verification',
])

function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? { year, month, day }
    : null
}

function anchoredDate(start, offset) {
  const index = start.year * 12 + start.month - 1 + offset
  const year = Math.floor(index / 12)
  const monthIndex = index % 12
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  return new Date(year, monthIndex, Math.min(start.day, lastDay))
}

function normalizeStatus(status) {
  return String(status || '').toLowerCase()
}

function normalizeMethod(method) {
  return String(method || '').toLowerCase()
}

function isMonthlyRentPayment(payment) {
  return !NON_MONTHLY_RENT_METHODS.has(normalizeMethod(payment?.payment_method))
}

function isConfirmedRent(payment) {
  return normalizeStatus(payment?.status) === 'success' && isMonthlyRentPayment(payment)
}

function isPendingRentPayment(payment) {
  return PENDING_RENT_STATUSES.has(normalizeStatus(payment?.status)) && isMonthlyRentPayment(payment)
}

function uniquePayments(payments = [], predicate = () => true) {
  const seen = new Set()
  return (payments || [])
    .filter(predicate)
    .filter(payment => {
      const key = payment?.id || `${payment?.payment_date || payment?.created_at || ''}:${payment?.payment_method || ''}:${payment?.amount || 0}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => new Date(a.payment_date || a.created_at || 0) - new Date(b.payment_date || b.created_at || 0))
}

function uniqueConfirmedRentPayments(payments = []) {
  return uniquePayments(payments, isConfirmedRent)
}

function uniquePendingRentPayments(payments = []) {
  return uniquePayments(payments, isPendingRentPayment)
}

function baselinePaidPeriodsFromTenant(tenant, start, rent, confirmedPayments) {
  if (confirmedPayments.length > 0) return 0
  if (normalizeStatus(tenant?.rent_status) !== 'paid') return 0
  if (Number(tenant?.pending_amount || 0) > 0) return 0
  if (Number(tenant?.total_paid || 0) > 0) return 0
  const recognizedAt = parseDateOnly(tenant?.rent_recognized_at || tenant?.processed_at || tenant?.created_at)
  if (!recognizedAt) return 0
  const recognizedDate = new Date(recognizedAt.year, recognizedAt.month - 1, recognizedAt.day)
  let periods = 0
  while (periods < 600 && anchoredDate(start, periods) < recognizedDate) periods += 1
  return periods
}

function inactiveResult() {
  return {
    status: 'inactive',
    dueDate: null,
    daysUntilDue: null,
    dueAmount: 0,
    message: 'Tenancy inactive',
    oldestUnpaidCycle: null,
    isFullyUpToDate: false,
    paidForCurrentCycle: false,
    pendingConfirmationCount: 0,
  }
}

function unknownResult(tenant) {
  return {
    status: 'unknown',
    dueDate: null,
    daysUntilDue: null,
    dueAmount: Number(tenant?.pending_amount || 0),
    message: 'Due date unavailable',
    oldestUnpaidCycle: null,
    isFullyUpToDate: false,
    paidForCurrentCycle: false,
    pendingConfirmationCount: 0,
  }
}

function calculateCanonicalRentDue(tenant, payments = [], now = new Date()) {
  if (['inactive', 'archived'].includes(normalizeStatus(tenant?.status))) return inactiveResult()

  const start = parseDateOnly(tenant?.rent_start_date || tenant?.move_in_date || tenant?.join_date)
  const rent = Number(tenant?.rent_amount || tenant?.monthly_rent)
  if (!start || !(rent > 0)) return unknownResult(tenant)

  const confirmedPayments = uniqueConfirmedRentPayments(payments)
  const pendingPayments = uniquePendingRentPayments(payments)
  const confirmedAmount = confirmedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const pendingAmount = pendingPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

  let remaining = confirmedAmount
  let paidPeriods = baselinePaidPeriodsFromTenant(tenant, start, rent, confirmedPayments)
  while (remaining + 0.0001 >= rent) {
    remaining -= rent
    paidPeriods += 1
  }

  const dueDate = anchoredDate(start, paidPeriods)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const daysUntilDue = Math.round((dueDate - today) / DAY_MS)
  const paidAmountForOpenCycle = Math.max(0, remaining)
  const openCycleDueAmount = Math.max(0, rent - paidAmountForOpenCycle)
  const confirmedFullCycleCount = Math.floor((confirmedAmount + 0.0001) / rent)
  const isCoveredByConfirmedPayment = confirmedFullCycleCount > 0 && paidAmountForOpenCycle === 0
  const oldestUnpaidCycle = {
    index: paidPeriods,
    dueDate,
    dueAmount: openCycleDueAmount,
    paidAmount: paidAmountForOpenCycle,
    requiredAmount: rent,
  }
  const base = {
    dueDate,
    daysUntilDue,
    dueAmount: openCycleDueAmount,
    paidPeriods,
    confirmedAmount,
    pendingAmount,
    pendingConfirmationCount: pendingPayments.length,
    paidAmountForOpenCycle,
    cycleIndex: paidPeriods,
    paidForCurrentCycle: false,
    currentCyclePaid: false,
    oldestUnpaidCycle,
    isFullyUpToDate: false,
  }

  if (pendingPayments.length > 0 && (!isCoveredByConfirmedPayment || daysUntilDue <= 3)) {
    return {
      ...base,
      status: 'pending_confirmation',
      message: 'Pending confirmation',
      urgent: daysUntilDue <= 3,
    }
  }

  if (isCoveredByConfirmedPayment && daysUntilDue > 3) {
    return {
      ...base,
      status: 'paid',
      dueAmount: 0,
      message: 'Paid',
      urgent: false,
      paidForCurrentCycle: true,
      currentCyclePaid: true,
      isFullyUpToDate: true,
    }
  }

  if (daysUntilDue < 0) {
    return {
      ...base,
      status: 'overdue',
      message: `Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? '' : 's'}`,
      urgent: true,
    }
  }
  if (daysUntilDue === 0) {
    return { ...base, status: 'due_today', message: 'Due today', urgent: true }
  }
  if (daysUntilDue <= 3) {
    return {
      ...base,
      status: 'due_soon',
      message: `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`,
      urgent: true,
    }
  }
  return {
    ...base,
    status: 'upcoming',
    message: `Due in ${daysUntilDue} days`,
    urgent: false,
  }
}

function formatRentDueLabel(result = {}) {
  if (result.status === 'paid') return 'Paid'
  if (result.status === 'pending_confirmation') return 'Pending confirmation'
  if (result.status === 'inactive') return result.message || 'Tenancy inactive'
  if (result.status === 'unknown') return result.message || 'Due date unavailable'
  const days = Number(result.daysUntilDue)
  if (!Number.isFinite(days)) return result.message || 'Due date unavailable'
  if (days < 0) {
    const overdue = Math.abs(days)
    return `Overdue by ${overdue} day${overdue === 1 ? '' : 's'}`
  }
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}

module.exports = {
  NON_MONTHLY_RENT_METHODS,
  PENDING_RENT_STATUSES,
  parseDateOnly,
  anchoredDate,
  isConfirmedRent,
  isPendingRentPayment,
  uniqueConfirmedRentPayments,
  uniquePendingRentPayments,
  calculateCanonicalRentDue,
  formatRentDueLabel,
}
