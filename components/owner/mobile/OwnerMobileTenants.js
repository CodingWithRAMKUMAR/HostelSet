import { useMemo, useState } from 'react'
import NotificationBell from '../../common/NotificationBell'
import DashboardIcon from '../../dashboard/DashboardIcon'
import { formatCurrency, formatDate } from '../../../lib/utils'
import OwnerMobileTenantActionsSheet from './OwnerMobileTenantActionsSheet'

function Header({ onBack, onAddTenant }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 px-3 pt-[calc(env(safe-area-inset-top)_+_0.25rem)] pb-1 text-white">
      <div className="flex min-h-[42px] items-center gap-2">
        <button type="button" onClick={onBack} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base" aria-label="Back">←</button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-black leading-tight">Tenants</p>
          <p className="truncate text-[10px] font-medium leading-tight text-slate-400">Residents and rent status</p>
        </div>
        <NotificationBell listenForGlobalOpen />
        <button type="button" onClick={onAddTenant} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-lg font-black" aria-label="Add tenant">+</button>
      </div>
    </header>
  )
}

export default function OwnerMobileTenants({ tenants = [], onBack, onAddTenant, onCollect, onHistory, onTenantProfile, onDelete, onConfirmPayment }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedTenant, setSelectedTenant] = useState(null)
  const filteredTenants = useMemo(() => tenants.filter(tenant => {
    const text = `${tenant.name || ''} ${tenant.phone || ''} ${tenant.room_number || ''} ${tenant.rent_status || ''}`.toLowerCase()
    if (query && !text.includes(query.toLowerCase())) return false
    if (filter === 'due') return Number(tenant.pending_amount || 0) > 0 || tenant.rent_status !== 'paid'
    if (filter === 'paid') return tenant.rent_status === 'paid'
    return true
  }), [tenants, query, filter])

  return (
    <div className="min-h-dvh max-w-full overflow-x-hidden bg-slate-950 pb-[calc(5.1rem_+_env(safe-area-inset-bottom))]">
      <Header onBack={onBack} onAddTenant={onAddTenant} />
      <main className="mx-auto max-w-md space-y-2 px-3 py-2">
        <label className="flex h-9 items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-3 text-slate-300">
          <DashboardIcon name="search" className="h-4 w-4 shrink-0" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tenants" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
        </label>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {['all', 'due', 'paid'].map(item => <button key={item} type="button" onClick={() => setFilter(item)} className={`h-7 shrink-0 rounded-full px-3 text-[11px] font-black capitalize ${filter === item ? 'bg-orange-500 text-white' : 'bg-white/8 text-slate-300'}`}>{item}</button>)}
        </div>
        {filteredTenants.length === 0 ? <div className="rounded-2xl bg-white/8 p-4 text-center text-sm text-slate-400">No matching tenants.</div> : filteredTenants.map(tenant => (
          <article key={tenant.id} className="flex min-h-[82px] min-w-0 items-center gap-2 rounded-3xl border border-white/10 bg-white p-2.5 shadow-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">{tenant.name?.charAt(0) || '?'}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black leading-tight text-slate-900">{tenant.name || 'Unnamed'}</p>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">Room {tenant.room_number || tenant.room_id || 'N/A'} · {tenant.phone || 'No phone'}</p>
              <p className="mt-1 truncate text-[11px] text-slate-400">Joined {formatDate(tenant.move_in_date)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${tenant.rent_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{tenant.rent_status || 'active'}</span>
              <span className="text-xs font-black text-slate-900">{formatCurrency(tenant.pending_amount || tenant.rent_amount || 0)}</span>
              <button type="button" onClick={() => setSelectedTenant(tenant)} className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-lg font-black leading-none text-slate-500" aria-label={`Actions for ${tenant.name}`}>⋮</button>
            </div>
          </article>
        ))}
      </main>
      <OwnerMobileTenantActionsSheet tenant={selectedTenant} onClose={() => setSelectedTenant(null)} onCollect={onCollect} onHistory={onHistory} onProfile={onTenantProfile} onConfirmPayment={onConfirmPayment} onDelete={onDelete} />
    </div>
  )
}
