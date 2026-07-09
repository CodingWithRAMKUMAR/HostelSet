import { AdminEmptyState, AdminLoadingState, AdminMobilePage, AdminStatusChip } from './AdminMobileShell'

export default function AdminMobileOwners({ owners = [], loading, avatar = 'A', onBack, onProfile, onView, onToggle }) {
  return (
    <AdminMobilePage title="Owners" subtitle={`${owners.length} registered owners`} avatar={avatar} onBack={onBack} onProfile={onProfile}>
      {loading && owners.length === 0 ? <AdminLoadingState /> : null}
      {!loading && owners.length === 0 ? <AdminEmptyState>No owners registered yet.</AdminEmptyState> : null}
      {owners.map(owner => (
        <article key={owner.id} className="min-w-0 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
          <div className="flex min-w-0 items-start gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-black text-orange-700">
              {(owner.full_name || owner.email || 'O').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="truncate text-sm font-black leading-tight text-slate-900">{owner.full_name || 'Unnamed owner'}</p>
                <AdminStatusChip tone={owner.is_active ? 'emerald' : 'red'}>{owner.is_active ? 'Active' : 'Suspended'}</AdminStatusChip>
              </div>
              <p className="truncate text-[11px] text-slate-500">{owner.email || 'No email'}</p>
              <div className="mt-2 flex items-center justify-end gap-2">
                <button type="button" onClick={() => onView?.(owner)} className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">View</button>
                <button type="button" onClick={() => onToggle?.(owner.id, owner.is_active)} className={`rounded-lg px-2 py-1 text-xs font-bold ${owner.is_active ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                  {owner.is_active ? 'Suspend' : 'Activate'}
                </button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </AdminMobilePage>
  )
}
