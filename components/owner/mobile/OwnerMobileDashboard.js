import MobileTopbar from '../../dashboard/MobileTopbar'
import DashboardIcon from '../../dashboard/DashboardIcon'
import { formatCurrency } from '../../../lib/utils'

function Header({ title, subtitle, avatar, onProfile }) {
  return (
    <MobileTopbar title={title} subtitle={subtitle} isHome onProfile={onProfile} avatar={avatar} fallbackIcon="users" stablePaint />
  )
}

function Stat({ label, value, icon, onClick }) {
  const Card = onClick ? 'button' : 'div'
  return (
    <Card type={onClick ? 'button' : undefined} onClick={onClick} className="flex min-h-[68px] min-w-0 items-center gap-2 rounded-3xl border border-white/10 bg-white p-2.5 text-left shadow-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><DashboardIcon name={icon} className="h-4 w-4" /></span>
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <span className="block truncate text-lg font-black leading-tight text-slate-900">{value}</span>
      </span>
    </Card>
  )
}

export default function OwnerMobileDashboard({ property, stats, counts, membershipActive, membershipStatus, membershipExpiry, daysLeft, pendingMembershipRequest, avatar = 'O', onProfile, onNavigate, onMembership }) {
  return (
    <div className="max-w-full overflow-x-hidden bg-slate-950 pb-[calc(5.1rem_+_env(safe-area-inset-bottom))]">
      <Header title="HostelSet" subtitle={property?.name} avatar={avatar} onProfile={onProfile} />
      <main className="mx-auto max-w-md space-y-2 px-3 py-2">
        <section className="rounded-3xl border border-white/10 bg-slate-900 p-2.5 text-white shadow-sm">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-orange-300">Current property</p>
              <h1 className="truncate text-base font-black">{property?.name || 'Property'}</h1>
              <p className="text-xs text-slate-400">{stats?.occupied || 0} occupied · {stats?.vacant || 0} available</p>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-bold">Owner</span>
          </div>
        </section>
        <button type="button" onClick={onMembership} className="flex w-full min-w-0 items-center justify-between gap-2 rounded-3xl border border-white/10 bg-white p-2.5 text-left shadow-sm">
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-widest text-orange-500">Membership</span>
            <span className="mt-0.5 block truncate text-xs font-bold text-slate-600">
              {membershipExpiry ? `Expires ${membershipExpiry.toLocaleDateString('en-IN')}` : pendingMembershipRequest ? 'Request awaiting admin review' : 'No expiry date available'}
            </span>
          </span>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${membershipActive ? 'bg-emerald-100 text-emerald-700' : pendingMembershipRequest ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'}`}>
            {membershipActive ? (Number.isFinite(daysLeft) ? `${daysLeft}d left` : 'Active') : pendingMembershipRequest ? 'Pending' : membershipStatus === 'expired' ? 'Expired' : 'Request'}
          </span>
        </button>

        <section className="grid grid-cols-2 gap-2">
          <Stat label="Rooms" icon="rooms" value={stats?.totalRooms || 0} onClick={() => onNavigate('rooms')} />
          <Stat label="Tenants" icon="users" value={counts?.tenants || 0} onClick={() => onNavigate('tenants')} />
          <Stat label="Collected" icon="payments" value={formatCurrency(stats?.totalCollected || 0)} />
          <Stat label="Pending" icon="payments" value={formatCurrency(stats?.pendingAmount || 0)} onClick={() => onNavigate('rent-payments')} />
          <Stat label="Applications" icon="requests" value={counts?.applications || 0} onClick={() => onNavigate('applications')} />
          <Stat label="Complaints" icon="complaints" value={counts?.complaints || 0} onClick={() => onNavigate('complaints')} />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white p-2 shadow-sm">
          <p className="mb-2 text-xs font-black text-slate-900">Action required</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['rent-payments', 'Payments', counts?.payments || 0, 'payments'],
              ['applications', 'Applications', counts?.applications || 0, 'requests'],
              ['vacate', 'Vacate', counts?.vacate || 0, 'requests'],
              ['room-change', 'Room changes', counts?.roomChanges || 0, 'requests'],
            ].map(([id, label, count, icon]) => (
              <button key={id} type="button" onClick={() => onNavigate(id)} className="flex h-8 min-w-0 items-center justify-between gap-2 rounded-2xl bg-slate-50 px-2 text-left">
                <span className="flex min-w-0 items-center gap-1.5"><DashboardIcon name={icon} className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate text-xs font-semibold text-slate-600">{label}</span></span>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">{count}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
