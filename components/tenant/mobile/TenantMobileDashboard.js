import NotificationBell from '../../common/NotificationBell'
import { formatCurrency, getSharingDetails } from '../../../lib/utils'

function Header({ title, subtitle, avatar, onProfile }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 px-3 pt-[calc(env(safe-area-inset-top)_+_0.375rem)] pb-1.5 text-white">
      <div className="flex min-h-[46px] items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-sm font-black">HS</div>
        <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-black leading-tight">{title}</p>{subtitle && <p className="truncate text-[10px] font-medium leading-tight text-slate-400">{subtitle}</p>}</div>
        <NotificationBell listenForGlobalOpen />
        <button type="button" onClick={onProfile} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-sm font-bold" aria-label="Open account menu">{avatar}</button>
      </div>
    </header>
  )
}

function Stat({ label, value, onClick }) {
  const Card = onClick ? 'button' : 'div'
  return (
    <Card type={onClick ? 'button' : undefined} onClick={onClick} className="min-w-0 rounded-2xl border border-slate-100 bg-white p-2 text-left shadow-sm">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate text-base font-black leading-tight text-slate-900">{value}</p>
    </Card>
  )
}

export default function TenantMobileDashboard({ tenant, room, property, notices = [], complaints = [], rentStatus = {}, existingVacateRequest, pendingRoomChangeRequest, avatar = 'U', onProfile, onNavigate, onPayRent }) {
  return (
    <div className="min-h-dvh max-w-full overflow-x-hidden bg-slate-50 pb-[calc(5.75rem_+_env(safe-area-inset-bottom))]">
      <Header title="Dashboard" subtitle={property?.name} avatar={avatar} onProfile={onProfile} />
      <main className="mx-auto max-w-md space-y-2.5 px-3 py-2.5">
        <section className="rounded-2xl bg-slate-950 p-3 text-white shadow-sm">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-orange-300">Welcome</p>
              <h1 className="truncate text-base font-black">{tenant?.name || 'Tenant'}</h1>
              <p className="truncate text-xs text-slate-400">Room {room?.room_number || '—'} · {getSharingDetails(room?.sharing_type || '')?.label || 'Room'}</p>
            </div>
            <span className="max-w-[42%] truncate rounded-full bg-white/10 px-2 py-1 text-[11px] font-bold">{rentStatus?.status || 'active'}</span>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <Stat label="Monthly rent" value={formatCurrency(tenant?.rent_amount || 0)} onClick={() => onNavigate('payments')} />
          <Stat label="Pending" value={formatCurrency(tenant?.pending_amount || 0)} onClick={() => onNavigate('payments')} />
          <Stat label="Paid" value={formatCurrency(tenant?.total_paid || 0)} onClick={() => onNavigate('payments')} />
          <Stat label="Deposit" value={formatCurrency(tenant?.security_deposit_amount || 0)} />
          <Stat label="Notices" value={notices.length} onClick={() => onNavigate('notices')} />
          <Stat label="Complaints" value={complaints.length} onClick={() => onNavigate('complaints')} />
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
          <p className="mb-2 text-xs font-black text-slate-900">Quick actions</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onPayRent} className="rounded-xl bg-orange-500 px-2 py-2 text-xs font-bold text-white">Pay rent</button>
            <button type="button" onClick={() => onNavigate('complaints')} className="rounded-xl bg-slate-50 px-2 py-2 text-xs font-bold text-slate-700">Complaint</button>
            <button type="button" onClick={() => onNavigate('room-change')} className="rounded-xl bg-slate-50 px-2 py-2 text-xs font-bold text-slate-700">{pendingRoomChangeRequest ? 'Move pending' : 'Room change'}</button>
            <button type="button" onClick={() => onNavigate('vacate')} className="rounded-xl bg-slate-50 px-2 py-2 text-xs font-bold text-slate-700">{existingVacateRequest ? 'Vacate status' : 'Vacate'}</button>
          </div>
        </section>
      </main>
    </div>
  )
}
