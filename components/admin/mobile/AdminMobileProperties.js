import { AdminEmptyState, AdminLoadingState, AdminMobilePage, AdminStatusChip } from './AdminMobileShell'

export default function AdminMobileProperties({ properties = [], loading, avatar = 'A', onBack, onProfile, onView, onDelete }) {
  return (
    <AdminMobilePage title="Properties" subtitle={`${properties.length} platform properties`} avatar={avatar} onBack={onBack} onProfile={onProfile}>
      {loading && properties.length === 0 ? <AdminLoadingState /> : null}
      {!loading && properties.length === 0 ? <AdminEmptyState>No properties registered yet.</AdminEmptyState> : null}
      {properties.map(property => (
        <article key={property.id} className="min-w-0 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-tight text-slate-900">{property.name || 'Unnamed property'}</p>
              <p className="truncate text-[11px] text-slate-500">{property.users?.full_name || 'No owner linked'}</p>
            </div>
            <AdminStatusChip tone={property.is_active ? 'emerald' : 'red'}>{property.is_active ? 'Active' : 'Inactive'}</AdminStatusChip>
          </div>
          <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
            <p className="truncate font-mono text-[10px] text-slate-400">{property.id}</p>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => onView?.(property)} className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">View</button>
              <button type="button" onClick={() => onDelete?.(property.id)} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-600">Delete</button>
            </div>
          </div>
        </article>
      ))}
    </AdminMobilePage>
  )
}
