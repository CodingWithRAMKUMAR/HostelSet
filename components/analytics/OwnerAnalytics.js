import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '../../lib/utils'

const monthKey = (value) => {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

const isThisMonth = (value) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return false
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

const amount = (value) => Number(value || 0)
const isDeposit = (payment) => payment?.payment_method === 'security_deposit'
const isRentPayment = (payment) => payment?.status === 'success' && !isDeposit(payment)
const isDepositPayment = (payment) => payment?.status === 'success' && isDeposit(payment)

function MetricCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-800">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-800">{title}</h2>
      {children}
    </section>
  )
}

export default function OwnerAnalytics({
  rooms = [],
  tenants = [],
  archivedTenants = [],
  payments = [],
  pendingPayments = [],
  applications = [],
  existingImports = [],
  complaints = [],
  notices = [],
  vacateRequests = [],
  roomChangeRequests = [],
}) {
  const analytics = useMemo(() => {
    const activeTenants = tenants.filter(tenant => ['active', 'notice_period', 'payment_pending'].includes(tenant.status))
    const totalCapacity = rooms.reduce((sum, room) => sum + amount(room.capacity), 0)
    const occupiedBeds = rooms.reduce((sum, room) => sum + amount(room.current_occupants), 0)
    const availableBeds = Math.max(totalCapacity - occupiedBeds, 0)
    const rentPayments = payments.filter(isRentPayment)
    const depositPayments = payments.filter(isDepositPayment)
    const pendingRentPayments = pendingPayments.filter(payment => !isDeposit(payment))

    const trendMap = new Map()
    const ensureMonth = (key) => {
      if (!trendMap.has(key)) trendMap.set(key, { month: key, rent: 0, deposits: 0, applications: 0, complaints: 0 })
      return trendMap.get(key)
    }
    payments.forEach(payment => {
      const bucket = ensureMonth(monthKey(payment.payment_date || payment.created_at))
      if (isRentPayment(payment)) bucket.rent += amount(payment.amount)
      if (isDepositPayment(payment)) bucket.deposits += amount(payment.amount)
    })
    applications.forEach(application => { ensureMonth(monthKey(application.created_at)).applications += 1 })
    complaints.forEach(complaint => { ensureMonth(monthKey(complaint.created_at)).complaints += 1 })

    return {
      rentThisMonth: rentPayments.filter(payment => isThisMonth(payment.payment_date || payment.created_at)).reduce((sum, payment) => sum + amount(payment.amount), 0),
      rentAllTime: rentPayments.reduce((sum, payment) => sum + amount(payment.amount), 0),
      depositsCollected: depositPayments.reduce((sum, payment) => sum + amount(payment.amount), 0),
      pendingRent: activeTenants.reduce((sum, tenant) => sum + amount(tenant.pending_amount), 0),
      pendingPayments: pendingRentPayments.length,
      pendingPaymentAmount: pendingRentPayments.reduce((sum, payment) => sum + amount(payment.amount), 0),
      rooms: rooms.length,
      totalCapacity,
      occupiedBeds,
      availableBeds,
      occupancy: totalCapacity ? Math.round((occupiedBeds / totalCapacity) * 100) : 0,
      activeTenants: activeTenants.length,
      archivedTenants: archivedTenants.length,
      vacates: vacateRequests.filter(item => item.status === 'pending').length,
      roomChanges: roomChangeRequests.filter(item => item.status === 'pending').length,
      pendingApplications: applications.filter(item => item.status === 'pending').length,
      approvedApplications: applications.filter(item => item.status === 'approved').length,
      rejectedApplications: applications.filter(item => item.status === 'rejected').length,
      pendingImports: existingImports.filter(item => item.status === 'pending_owner_review').length,
      approvedImports: existingImports.filter(item => item.status === 'approved').length,
      rejectedImports: existingImports.filter(item => item.status === 'rejected').length,
      openComplaints: complaints.filter(item => item.status !== 'resolved').length,
      resolvedComplaints: complaints.filter(item => item.status === 'resolved').length,
      activeNotices: notices.length,
      trend: Array.from(trendMap.values()).slice(-6),
    }
  }, [rooms, tenants, archivedTenants, payments, pendingPayments, applications, existingImports, complaints, notices, vacateRequests, roomChangeRequests])

  return (
    <div className="space-y-6">
      <Section title="Revenue Summary">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Rent this month" value={formatCurrency(analytics.rentThisMonth)} />
          <MetricCard label="Rent all time" value={formatCurrency(analytics.rentAllTime)} hint="Excludes deposits" />
          <MetricCard label="Deposits collected" value={formatCurrency(analytics.depositsCollected)} hint="Tracked separately" />
          <MetricCard label="Pending rent" value={formatCurrency(analytics.pendingRent)} />
          <MetricCard label="Pending payments" value={analytics.pendingPayments} hint={formatCurrency(analytics.pendingPaymentAmount)} />
        </div>
      </Section>

      <Section title="Occupancy Analytics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Total rooms" value={analytics.rooms} />
          <MetricCard label="Total capacity" value={analytics.totalCapacity} />
          <MetricCard label="Occupied beds" value={analytics.occupiedBeds} />
          <MetricCard label="Available beds" value={analytics.availableBeds} />
          <MetricCard label="Occupancy" value={`${analytics.occupancy}%`} />
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Tenant Movement">
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard label="Active tenants" value={analytics.activeTenants} />
            <MetricCard label="Archived tenants" value={analytics.archivedTenants} />
            <MetricCard label="Pending vacates" value={analytics.vacates} />
            <MetricCard label="Room changes" value={analytics.roomChanges} />
          </div>
        </Section>
        <Section title="Applications Funnel">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard label="Pending apps" value={analytics.pendingApplications} />
            <MetricCard label="Approved apps" value={analytics.approvedApplications} />
            <MetricCard label="Rejected apps" value={analytics.rejectedApplications} />
            <MetricCard label="Imports pending" value={analytics.pendingImports} />
            <MetricCard label="Imports approved" value={analytics.approvedImports} />
            <MetricCard label="Imports rejected" value={analytics.rejectedImports} />
          </div>
        </Section>
      </div>

      <Section title="Complaints / Notices">
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Open complaints" value={analytics.openComplaints} />
          <MetricCard label="Resolved complaints" value={analytics.resolvedComplaints} />
          <MetricCard label="Active notices" value={analytics.activeNotices} />
        </div>
      </Section>

      <Section title="Monthly Trend">
        {analytics.trend.length ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value, name) => name === 'rent' || name === 'deposits' ? formatCurrency(value) : value} />
                <Bar dataKey="rent" fill="#f97316" name="Rent" />
                <Bar dataKey="deposits" fill="#64748b" name="Deposits" />
                <Bar dataKey="applications" fill="#22c55e" name="Applications" />
                <Bar dataKey="complaints" fill="#ef4444" name="Complaints" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-sm text-gray-500">No trend data yet.</p>}
      </Section>
    </div>
  )
}
