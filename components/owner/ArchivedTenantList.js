import { formatDate } from '../../lib/utils';

export default function ArchivedTenantList({ tenants = [], onViewHistory = () => {}, loadingId = null }) {
  if (!tenants.length) return <div className="rounded-xl bg-gray-50 py-12 text-center text-gray-500">No archived tenants found.</div>;

  return (
    <div className="space-y-4">
      {tenants.map(tenant => (
        <div key={tenant.id} className="flex flex-col justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-slate-800">{tenant.name}</h3>
            <p className="text-sm text-gray-500">Room {tenant.room_number || 'N/A'}</p>
            <div className="mt-2 grid gap-1 text-xs text-gray-500 sm:grid-cols-3 sm:gap-4">
              <span>Move-in: {formatDate(tenant.move_in_date)}</span>
              <span>Checkout: {tenant.checkout_date ? formatDate(tenant.checkout_date) : 'Not recorded'}</span>
              <span>Archived: {formatDate(tenant.archived_at || tenant.updated_at)}</span>
            </div>
          </div>
          <button onClick={() => onViewHistory(tenant)} disabled={loadingId === tenant.id} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {loadingId === tenant.id ? 'Loading…' : 'View History'}
          </button>
        </div>
      ))}
    </div>
  );
}
