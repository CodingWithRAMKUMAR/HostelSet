import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '../../lib/utils'

const amount = (value) => Number(value || 0)
const isDeposit = (payment) => payment?.payment_method === 'security_deposit'
const isSuccessfulRent = (payment) => payment?.status === 'success' && !isDeposit(payment)
const isSuccessfulDeposit = (payment) => payment?.status === 'success' && isDeposit(payment)

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

function TopList({ title, rows, valueLabel }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <h3 className="mb-3 text-sm font-bold text-slate-800">{title}</h3>
      <div className="space-y-2">
        {rows.length ? rows.map(row => (
          <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="truncate text-slate-700">{row.name}</span>
            <span className="shrink-0 font-semibold text-slate-900">{valueLabel(row.value)}</span>
          </div>
        )) : <p className="text-sm text-gray-500">No data yet.</p>}
      </div>
    </div>
  )
}

export default function AdminAnalytics({
  properties = [],
  rooms = [],
  tenants = [],
  payments = [],
  applications = [],
  imports: existingImports = [],
  complaints = [],
  vacates = [],
  roomChanges = [],
  owners = [],
  loading = false,
  error = '',
}) {
  const analytics = useMemo(() => {
    const activeTenants = tenants.filter(tenant => ['active', 'notice_period', 'payment_pending'].includes(tenant.status))
    const rentPayments = payments.filter(isSuccessfulRent)
    const depositPayments = payments.filter(isSuccessfulDeposit)
    const pendingPayments = payments.filter(payment => payment.status === 'payment_pending' && !isDeposit(payment))
    const propertyMap = new Map(properties.map(property => [property.id, { ...property, revenue: 0, occupancy: 0, capacity: 0, pendingRent: 0, complaints: 0 }]))

    rooms.forEach(room => {
      const property = propertyMap.get(room.property_id)
      if (!property) return
      property.capacity += amount(room.capacity)
      property.occupancy += amount(room.current_occupants)
    })
    activeTenants.forEach(tenant => {
      const property = propertyMap.get(tenant.property_id)
      if (property) property.pendingRent += amount(tenant.pending_amount)
    })
    rentPayments.forEach(payment => {
      const propertyId = payment.tenants?.property_id
      const property = propertyMap.get(propertyId)
      if (property) property.revenue += amount(payment.amount)
    })
    complaints.forEach(complaint => {
      const property = propertyMap.get(complaint.property_id)
      if (property) property.complaints += 1
    })

    const trendMap = new Map()
    const ensureMonth = (key) => {
      if (!trendMap.has(key)) trendMap.set(key, { month: key, properties: 0, tenants: 0, applications: 0, revenue: 0 })
      return trendMap.get(key)
    }
    properties.forEach(property => { ensureMonth(monthKey(property.created_at)).properties += 1 })
    tenants.forEach(tenant => { ensureMonth(monthKey(tenant.created_at)).tenants += 1 })
    applications.forEach(application => { ensureMonth(monthKey(application.created_at)).applications += 1 })
    rentPayments.forEach(payment => { ensureMonth(monthKey(payment.payment_date || payment.created_at)).revenue += amount(payment.amount) })

    const propertyRows = Array.from(propertyMap.values())
    const byDesc = key => [...propertyRows].sort((a, b) => amount(b[key]) - amount(a[key])).slice(0, 5).map(item => ({ id: item.id, name: item.name, value: item[key] }))

    return {
      totalOwners: owners.length,
      activeOwners: owners.filter(owner => owner.is_active).length,
      totalProperties: properties.length,
      activeTenants: activeTenants.length,
      applications: applications.length,
      imports: existingImports.length,
      complaints: complaints.length,
      vacates: vacates.length,
      totalRent: rentPayments.reduce((sum, payment) => sum + amount(payment.amount), 0),
      rentThisMonth: rentPayments.filter(payment => isThisMonth(payment.payment_date || payment.created_at)).reduce((sum, payment) => sum + amount(payment.amount), 0),
      deposits: depositPayments.reduce((sum, payment) => sum + amount(payment.amount), 0),
      pendingRent: activeTenants.reduce((sum, tenant) => sum + amount(tenant.pending_amount), 0),
      pendingPayments: pendingPayments.length,
      pendingApplications: applications.filter(item => item.status === 'pending').length,
      pendingImports: existingImports.filter(item => item.status === 'pending_owner_review').length,
      pendingComplaints: complaints.filter(item => item.status !== 'resolved').length,
      pendingRoomChanges: roomChanges.filter(item => item.status === 'pending').length,
      pendingVacates: vacates.filter(item => item.status === 'pending').length,
      trend: Array.from(trendMap.values()).slice(-6),
      topRevenue: byDesc('revenue'),
      topOccupancy: propertyRows
        .map(item => ({ id: item.id, name: item.name, value: item.capacity ? Math.round((item.occupancy / item.capacity) * 100) : 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
      topPendingRent: byDesc('pendingRent'),
      topComplaints: byDesc('complaints'),
    }
  }, [properties, rooms, tenants, payments, applications, existingImports, complaints, vacates, roomChanges, owners])

  if (loading) return <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-500">Loading analytics...</div>
  if (error) return <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">Analytics could not load: {error}</div>

  return (
    <div className="space-y-6">
      <Section title="Platform Summary">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total owners" value={analytics.totalOwners} />
          <MetricCard label="Active owners" value={analytics.activeOwners} />
          <MetricCard label="Total properties" value={analytics.totalProperties} />
          <MetricCard label="Active tenants" value={analytics.activeTenants} />
          <MetricCard label="Applications" value={analytics.applications} />
          <MetricCard label="Existing imports" value={analytics.imports} />
          <MetricCard label="Complaints" value={analytics.complaints} />
          <MetricCard label="Vacate requests" value={analytics.vacates} />
        </div>
      </Section>

      <Section title="Financial Summary">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Rent collected" value={formatCurrency(analytics.totalRent)} hint="Excludes deposits" />
          <MetricCard label="Rent this month" value={formatCurrency(analytics.rentThisMonth)} />
          <MetricCard label="Deposits collected" value={formatCurrency(analytics.deposits)} hint="Separate from rent" />
          <MetricCard label="Pending rent" value={formatCurrency(analytics.pendingRent)} />
          <MetricCard label="Pending payments" value={analytics.pendingPayments} />
        </div>
      </Section>

      <Section title="Growth Analytics">
        {analytics.trend.length ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value, name) => name === 'revenue' ? formatCurrency(value) : value} />
                <Bar dataKey="properties" fill="#f97316" name="New properties" />
                <Bar dataKey="tenants" fill="#22c55e" name="New tenants" />
                <Bar dataKey="applications" fill="#3b82f6" name="Applications" />
                <Bar dataKey="revenue" fill="#64748b" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-sm text-gray-500">No growth data yet.</p>}
      </Section>

      <Section title="Operational Analytics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Pending applications" value={analytics.pendingApplications} />
          <MetricCard label="Pending imports" value={analytics.pendingImports} />
          <MetricCard label="Pending complaints" value={analytics.pendingComplaints} />
          <MetricCard label="Pending room changes" value={analytics.pendingRoomChanges} />
          <MetricCard label="Pending vacates" value={analytics.pendingVacates} />
        </div>
      </Section>

      <Section title="Top Properties">
        <div className="grid gap-4 lg:grid-cols-2">
          <TopList title="Highest revenue" rows={analytics.topRevenue} valueLabel={formatCurrency} />
          <TopList title="Highest occupancy" rows={analytics.topOccupancy} valueLabel={value => `${value}%`} />
          <TopList title="Most pending rent" rows={analytics.topPendingRent} valueLabel={formatCurrency} />
          <TopList title="Most complaints" rows={analytics.topComplaints} valueLabel={value => value} />
        </div>
      </Section>
    </div>
  )
}
