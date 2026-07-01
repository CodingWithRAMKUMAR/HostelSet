import { formatCurrency, formatDate } from '../../../lib/utils';

function Empty() {
  return <p className="text-sm text-gray-400">No records.</p>;
}

export default function ArchivedTenantHistoryModal({ history, loading, onClose }) {
  const tenant = history?.tenant;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6" onClick={event => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div><h2 className="text-2xl font-bold text-slate-800">Archived Tenant History</h2>{tenant && <p className="text-sm text-gray-500">{tenant.name} · Room {tenant.room_number || 'N/A'}</p>}</div>
          <button onClick={onClose} className="text-2xl text-gray-400">×</button>
        </div>
        {loading || !history ? <div className="py-12 text-center text-gray-500">Loading history…</div> : (
          <div className="space-y-6">
            <section className="grid gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-3">
              <div><strong>Move-in</strong><div>{formatDate(tenant.move_in_date)}</div></div>
              <div><strong>Checkout</strong><div>{tenant.checkout_date ? formatDate(tenant.checkout_date) : 'Not recorded'}</div></div>
              <div><strong>Archived</strong><div>{formatDate(tenant.archived_at || tenant.updated_at)}</div></div>
            </section>

            <section><h3 className="mb-2 font-semibold">Payment History</h3>{history.payments?.length ? <div className="space-y-2">{history.payments.map(item => <div key={item.id} className="rounded-lg border p-3 text-sm">{formatDate(item.payment_date)} · {formatCurrency(item.amount)} · {item.payment_method} · {item.status}</div>)}</div> : <Empty />}</section>
            <section><h3 className="mb-2 font-semibold">Rent History</h3>{history.rents?.length ? <div className="space-y-2">{history.rents.map(item => <div key={item.id} className="rounded-lg border p-3 text-sm">{formatDate(item.period_start)} – {formatDate(item.period_end)} · {formatCurrency(item.amount)} · {item.status}</div>)}</div> : <Empty />}</section>
            <section><h3 className="mb-2 font-semibold">Complaint History</h3>{history.complaints?.length ? <div className="space-y-2">{history.complaints.map(item => <div key={item.id} className="rounded-lg border p-3 text-sm"><strong>{item.title}</strong><div>{item.description}</div><div className="text-gray-500">{item.status} · {formatDate(item.created_at)}</div></div>)}</div> : <Empty />}</section>
            <section><h3 className="mb-2 font-semibold">Ratings</h3>{history.ratings?.length ? <div className="space-y-2">{history.ratings.map(item => <div key={item.id} className="rounded-lg border p-3 text-sm">{item.rating}/5 · {item.review || 'No review'} · {formatDate(item.created_at)}</div>)}</div> : <Empty />}</section>
            <section><h3 className="mb-2 font-semibold">Checkout History</h3>{history.checkouts?.length ? <div className="space-y-2">{history.checkouts.map(item => <div key={item.id} className="rounded-lg border p-3 text-sm">{item.status} · Expected {formatDate(item.expected_check_out)} · Requested {formatDate(item.requested_date)}{item.rejection_reason && <div>Reason: {item.rejection_reason}</div>}</div>)}</div> : <Empty />}</section>
            <section><h3 className="mb-2 font-semibold">Room-change History</h3>{history.room_changes?.length ? <div className="space-y-2">{history.room_changes.map(item => <div key={item.id} className="rounded-lg border p-3 text-sm">Room {item.old_room_number || 'N/A'} → Room {item.new_room_number || 'N/A'} · {item.status} · {formatDate(item.requested_at)}{item.rejection_reason && <div>Reason: {item.rejection_reason}</div>}</div>)}</div> : <Empty />}</section>
          </div>
        )}
      </div>
    </div>
  );
}
