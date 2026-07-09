import { displayBloodGroup } from '../../../lib/bloodGroups'
import { AdminEmptyState, AdminLoadingState, AdminMobilePage, AdminStatusChip } from './AdminMobileShell'

function roleTone(role) {
  if (role === 'admin') return 'red'
  if (role === 'owner') return 'orange'
  if (role === 'tenant') return 'blue'
  return 'slate'
}

function UserRow({ user, onToggleStatus, onChangeRole }) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
      <div className="flex min-w-0 items-start gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
          {(user.full_name || user.email || 'U').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className="truncate text-sm font-black leading-tight text-slate-900">{user.full_name || 'Unnamed user'}</p>
            <AdminStatusChip tone={user.is_active ? 'emerald' : 'red'}>{user.is_active ? 'Active' : 'Inactive'}</AdminStatusChip>
          </div>
          <p className="truncate text-[11px] text-slate-500">{user.email || 'No email'}</p>
          <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
            <AdminStatusChip tone={roleTone(user.role)}>{user.role || 'user'}</AdminStatusChip>
            <div className="flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={() => onToggleStatus?.(user.id, user.is_active)} className={`rounded-lg px-2 py-1 text-xs font-bold ${user.is_active ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                {user.is_active ? 'Off' : 'On'}
              </button>
              <select defaultValue="" onChange={event => onChangeRole?.(user.id, event.target.value)} className="max-w-[96px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                <option value="" disabled>Role</option>
                <option value="tenant">Tenant</option>
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function TenantRow({ tenant, onView, onDelete }) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
      <div className="flex min-w-0 items-start gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">
          {(tenant.name || tenant.email || 'T').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className="truncate text-sm font-black leading-tight text-slate-900">{tenant.name || 'Unnamed tenant'}</p>
            <AdminStatusChip tone="blue">{String(tenant.status || 'unknown').replaceAll('_', ' ')}</AdminStatusChip>
          </div>
          <p className="truncate text-[11px] text-slate-500">
            Room {tenant.rooms?.room_number || 'N/A'} · {tenant.property?.name || 'No property'}
          </p>
          <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
            <p className="truncate text-[10px] font-medium leading-tight text-slate-400">{tenant.phone || tenant.email || 'No contact'} · {displayBloodGroup(tenant.blood_group)}</p>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => onView?.(tenant)} className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">View</button>
              <button type="button" onClick={() => onDelete?.(tenant.id, tenant.user_id)} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-600">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function AdminMobileUsers({
  title = 'Users',
  subtitle,
  mode = 'users',
  users = [],
  tenants = [],
  loading,
  error,
  avatar = 'A',
  onBack,
  onProfile,
  searchTerm,
  setSearchTerm,
  roleFilter,
  setRoleFilter,
  onToggleStatus,
  onChangeRole,
  onViewTenant,
  onDeleteTenant,
}) {
  const rows = mode === 'tenants' ? tenants : users
  return (
    <AdminMobilePage title={title} subtitle={subtitle || `${rows.length} records`} avatar={avatar} onBack={onBack} onProfile={onProfile}>
      {mode === 'users' && (
        <section className="grid grid-cols-[1fr_auto] gap-2">
          <input value={searchTerm || ''} onChange={event => setSearchTerm?.(event.target.value)} placeholder="Search users" className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400" />
          <select value={roleFilter || 'all'} onChange={event => setRoleFilter?.(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-400">
            <option value="all">All</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
            <option value="tenant">Tenant</option>
          </select>
        </section>
      )}
      {error ? <div className="rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div> : null}
      {loading && rows.length === 0 ? <AdminLoadingState /> : null}
      {!loading && rows.length === 0 ? <AdminEmptyState>No records found.</AdminEmptyState> : null}
      {mode === 'tenants'
        ? rows.map(tenant => <TenantRow key={tenant.id} tenant={tenant} onView={onViewTenant} onDelete={onDeleteTenant} />)
        : rows.map(user => <UserRow key={user.id} user={user} onToggleStatus={onToggleStatus} onChangeRole={onChangeRole} />)}
    </AdminMobilePage>
  )
}
