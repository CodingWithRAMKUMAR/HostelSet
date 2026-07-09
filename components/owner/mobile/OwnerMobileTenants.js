import NotificationBell from '../../common/NotificationBell'
import { formatCurrency, formatDate } from '../../../lib/utils'

function Header({ onBack, title, subtitle, avatar, onProfile }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 px-3 pt-[calc(env(safe-area-inset-top)_+_0.375rem)] pb-1.5 text-white">
      <div className="flex min-h-[46px] items-center gap-2">
        <button type="button" onClick={onBack} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg" aria-label="Back">&larr;</button>
        <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-black leading-tight">{title}</p>{subtitle && <p className="truncate text-[10px] font-medium leading-tight text-slate-400">{subtitle}</p>}</div>
        <NotificationBell listenForGlobalOpen />
        <button type="button" onClick={onProfile} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-sm font-bold" aria-label="Open account menu">{avatar}</button>
      </div>
    </header>
  )
}

export default function OwnerMobileTenants({ tenants = [], property, avatar = 'O', onBack, onProfile, onAddTenant, onCollect, onHistory, onTenantProfile, onDelete, onConfirmPayment }) {
  return (
    <div className="min-h-dvh max-w-full overflow-x-hidden bg-slate-50 pb-[calc(5.75rem_+_env(safe-area-inset-bottom))]">
      <Header title="Tenants" subtitle={property?.name} avatar={avatar} onBack={onBack} onProfile={onProfile} />
      <main className="mx-auto max-w-md space-y-2.5 px-3 py-2.5">
        <button type="button" onClick={onAddTenant} className="w-full rounded-2xl bg-orange-500 px-3 py-2 text-sm font-black text-white shadow-sm">+ Add Tenant</button>
        {tenants.length === 0 ? <div className="rounded-2xl bg-white p-4 text-center text-sm text-slate-500">No tenants found.</div> : tenants.map(tenant => (
          <div key={tenant.id} className="rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
            <div className="flex min-w-0 items-start gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">{tenant.name?.charAt(0) || '?'}</span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0"><p className="truncate text-sm font-black leading-tight text-slate-900">{tenant.name || 'Unnamed'}</p><p className="truncate text-[11px] text-slate-500">Room {tenant.room_number || tenant.room_id || 'N/A'} · {formatDate(tenant.move_in_date)}</p></div>
                  <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">{tenant.rent_status || 'active'}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(tenant.pending_amount || 0)}</p>
                  <details className="relative">
                    <summary className="list-none rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 [&::-webkit-details-marker]:hidden">Actions</summary>
                    <div className="absolute right-0 z-20 mt-1 w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                      <button onClick={() => onCollect(tenant)} className="block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50">Collect</button>
                      <button onClick={() => onHistory(tenant)} className="block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50">History</button>
                      <button onClick={() => onTenantProfile(tenant)} className="block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50">Profile</button>
                      <button onClick={() => onConfirmPayment(tenant)} className="block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50">Confirm</button>
                      <button onClick={() => onDelete(tenant)} className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-red-600 hover:bg-red-50">Delete</button>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
