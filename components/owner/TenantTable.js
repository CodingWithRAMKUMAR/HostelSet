import { memo, useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '../../lib/utils';
import { enrichTenantRentStatus } from '../../lib/tenantRentStatus';

function TenantAvatar({ tenant }) {
  const [failed, setFailed] = useState(false);
  const src = tenant?.profilePhotoUrl;
  if (src && !failed) {
    return <img src={src} alt={tenant?.name ? `${tenant.name} profile photo` : 'Tenant profile photo'} onError={() => setFailed(true)} className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white" aria-hidden="true">
      {tenant?.name?.charAt(0)?.toUpperCase() || '?'}
    </span>
  );
}

function statusClass(due = {}) {
  if (due.category === 'paid') return 'bg-emerald-100 text-emerald-700';
  if (due.status === 'overdue') return 'bg-red-100 text-red-700';
  if (due.status === 'due_today') return 'bg-amber-100 text-amber-800';
  if (due.category === 'upcoming') return 'bg-orange-100 text-orange-700';
  return 'bg-slate-100 text-slate-700';
}

function rentLabel(due = {}) {
  return due.label || 'Rent status unavailable';
}

function TenantTable({
  tenants = [],
  vacateRequests = [],
  onCollect = () => {},
  onHistory = () => {},
  onProfile = () => {},
  onDelete = () => {},
  onConfirmPayment = () => {},
  isSubmitting = false,
  getRoomNumberById = () => 'N/A',
  getTenantPhotoUrl = () => null,
  calculateRentDueStatus
}) {
  const rows = useMemo(() => tenants.map(tenant => {
    const due = tenant.rentSummary || enrichTenantRentStatus(tenant, [], undefined);
    return { tenant: { ...tenant, profilePhotoUrl: tenant.profilePhotoUrl || getTenantPhotoUrl(tenant) }, due, group: due.category };
  }), [tenants, getTenantPhotoUrl, calculateRentDueStatus]);

  if (!tenants || tenants.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 px-4 py-8 text-center">
        <div className="mb-2 text-3xl">👥</div>
        <p className="text-sm text-gray-500">No tenants found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map(({ tenant: t, due }) => {
        const vacate = vacateRequests.find(v => v.tenant_id === t.id && v.status === 'approved');
        const label = rentLabel(due);
        const dueDate = due.dueDate ? formatDate(due.dueDate) : null;

        return (
          <div key={t.id} className="max-w-full min-w-0 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition hover:shadow-md">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2">
                <TenantAvatar tenant={t} />
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold leading-tight text-slate-900">{t.name || 'Unnamed'}</h3>
                  <p className="mt-0.5 truncate text-xs leading-tight text-gray-500">Room {t.room_number || getRoomNumberById(t.room_id)}</p>
                  <p className="mt-0.5 truncate text-[11px] leading-tight text-gray-400">Joined {formatDate(t.move_in_date)}</p>
                </div>
              </div>
              <span title={label} aria-label={label} className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold leading-5 ${statusClass(due)}`}>
                {label}
              </span>
            </div>

            <div className="mt-2 flex min-w-0 items-center justify-between gap-2 rounded-xl bg-slate-50 p-2">
              <div className="min-w-0">
                <p className="text-[11px] leading-tight text-slate-400">{due.category === 'paid' ? 'Current cycle' : 'Pending'}</p>
                <p className="truncate text-sm font-bold leading-tight text-slate-900">{formatCurrency(t.pending_amount || 0)}</p>
                {dueDate && <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{due.category === 'paid' ? `Next due ${dueDate}` : `Due ${dueDate}`}</p>}
              </div>
              {vacate && <p className="truncate text-right text-[11px] text-gray-500">Vacate {formatDate(vacate.expected_check_out)}</p>}
            </div>

            <div className="mt-2 flex max-w-full flex-wrap items-center gap-1.5">
              <button onClick={() => onCollect(t)} disabled={isSubmitting} className="rounded-lg bg-green-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50">Collect</button>
              <button onClick={() => onHistory(t)} className="rounded-lg bg-gray-100 px-2 py-1 text-xs text-slate-700">History</button>
              <button onClick={() => onProfile(t)} className="rounded-lg bg-blue-100 px-2 py-1 text-xs text-blue-700">Profile</button>
              <details className="relative">
                <summary className="list-none rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 [&::-webkit-details-marker]:hidden">More</summary>
                <div className="absolute right-0 z-20 mt-1 w-28 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  <button onClick={() => onConfirmPayment(t)} className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-yellow-50">Confirm</button>
                  <button onClick={() => onDelete(t)} className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-red-600 hover:bg-red-50">Delete</button>
                </div>
              </details>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(TenantTable);
