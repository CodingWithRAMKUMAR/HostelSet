import { formatCurrency, formatDate } from '../../lib/utils';

export default function PreBookingList({ bookings = [], onApprove = () => {}, onReject = () => {}, onViewScreenshot = () => {}, isSubmitting = false }) {
  // Keep your existing filtering logic
  const pending = bookings?.filter(b => b.status === 'pending' && b.payment_status === 'pending') || [];

  if (pending.length === 0) {
    return <div className="text-center py-12 bg-gray-50 rounded-xl">No pending pre‑bookings waiting for payment verification.</div>;
  }

  return (
    <div className="space-y-4">
      {pending.map(booking => {
        const amountPaid = booking.pre_booking_fee_amount || 0;
        return (
          <div key={booking.id} className="bg-white rounded-xl border p-4 flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <p className="font-semibold">{booking.name}</p>
              <p className="text-sm text-gray-500">📞 {booking.phone}</p>
              <p className="text-sm text-gray-500">📧 {booking.email || 'No email'}</p>
              <p className="text-sm">Room: {booking.rooms?.room_number || 'N/A'}</p>
              <p className="text-sm">Message: {booking.message || 'None'}</p>
              <p className="text-sm font-semibold text-green-600">Pre‑booking fee paid: {formatCurrency(amountPaid)}</p>
              {booking.payment_screenshot && (
                <div className="mt-2">
                  <button onClick={() => onViewScreenshot(booking.payment_screenshot)} className="text-blue-600 underline text-sm">View Payment Screenshot</button>
                </div>
              )}
              {booking.payment_transaction_id && <p className="text-xs text-gray-400">UTR: {booking.payment_transaction_id}</p>}
              <p className="text-xs text-gray-400">Requested: {formatDate(booking.created_at)}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onApprove(booking.id, booking)}
                disabled={isSubmitting}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
              >
                Approve & Create Tenant
              </button>
              <button
                onClick={() => onReject(booking.id)}
                disabled={isSubmitting}
                className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
