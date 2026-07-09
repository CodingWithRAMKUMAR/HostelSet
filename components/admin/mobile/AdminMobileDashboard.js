import { formatCurrency } from '../../../lib/utils'
import { AdminMobileHeader } from './AdminMobileShell'

function statTarget(label) {
  return {
    Properties: 'properties',
    'Active Tenants': 'tenants',
    Owners: 'owners',
    'Active Owners': 'owners',
    Memberships: 'membership',
    'Rent Revenue': 'payments',
    Deposits: 'payments',
    'Pending Complaints': 'complaints',
    'Pending Vacates': 'vacate',
  }[label]
}

function StatCard({ stat, onNavigate }) {
  const target = statTarget(stat.label)
  const Card = target ? 'button' : 'div'
  return (
    <Card type={target ? 'button' : undefined} onClick={target ? () => onNavigate(target) : undefined} className="min-w-0 rounded-2xl border border-white/10 bg-white p-2 text-left shadow-sm">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{stat.label}</p>
      <p className="truncate text-lg font-black leading-tight text-slate-900">{stat.value}</p>
    </Card>
  )
}

export default function AdminMobileDashboard({ stats = [], globalStats = {}, realtimeConnected, avatar = 'A', onProfile, onNavigate, onRefresh }) {
  return (
    <div className="min-h-dvh max-w-full overflow-x-hidden bg-slate-950 pb-[calc(5.1rem_+_env(safe-area-inset-bottom))]">
      <AdminMobileHeader title="Admin dashboard" subtitle={realtimeConnected ? 'Platform live' : 'Platform console'} avatar={avatar} onProfile={onProfile} />
      <main className="mx-auto max-w-md space-y-2 px-3 py-2">
        <section className="rounded-2xl border border-white/10 bg-slate-900 p-2.5 text-white shadow-sm">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-orange-300">HostelSet platform</p>
              <h1 className="truncate text-base font-black">Operations control</h1>
              <p className="text-xs text-slate-400">{globalStats.totalProperties || 0} properties · {globalStats.totalTenants || 0} tenants</p>
            </div>
            <button type="button" onClick={onRefresh} className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[11px] font-bold">Refresh</button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          {stats.map(stat => <StatCard key={stat.label} stat={stat} onNavigate={onNavigate} />)}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white p-2 shadow-sm">
          <p className="mb-2 text-xs font-black text-slate-900">Action required</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['payments', 'Payments', formatCurrency(globalStats.totalRevenue || 0)],
              ['complaints', 'Complaints', globalStats.pendingComplaints || 0],
              ['vacate', 'Vacates', globalStats.pendingVacates || 0],
              ['users', 'Users', globalStats.totalUsers || globalStats.totalTenants || 0],
            ].map(([id, label, value]) => (
              <button key={id} type="button" onClick={() => onNavigate(id)} className="flex h-8 min-w-0 items-center justify-between gap-2 rounded-xl bg-slate-50 px-2 text-left">
                <span className="truncate text-xs font-semibold text-slate-600">{label}</span>
                <span className="truncate rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">{value}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
