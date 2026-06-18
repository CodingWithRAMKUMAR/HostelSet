import { formatDate, formatCurrency } from '../../lib/utils'

export default function PreBookingsList({ bookings, onApprove, onReject }) {
  if (!bookings.length) return <p className="text-center text-gray-500">No pre‑bookings</p>
  return (
    <div className="space-y-4">
      {bookings.map(b => (
        <div key={b.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex justify-between items-start">
          <div>
            <p className="font-semibold">{b.name}</p>
            <p className="text-sm text-gray-400">📞 {b.phone} | 📧 {b.email}</p>
            <p className="text-sm">Room {b.rooms?.room_number} - {b.properties?.name}</p>
            <p className="text-sm">Expected move‑in: {formatDate(b.expected_move_in_date)}</p>
            <p className="text-sm">Pre‑booking fee: {formatCurrency(b.pre_booking_fee_amount)}</p>
            <p className="text-xs text-gray-500">Status: {b.status} | Payment: {b.payment_status}</p>
            {b.payment_screenshot && <a href={b.payment_screenshot} target="_blank" className="text-purple-400 text-xs">View Screenshot</a>}
          </div>
          {b.status === 'pending' && (
            <div className="flex gap-2">
              <button onClick={() => onApprove(b.id)} className="bg-green-700 hover:bg-green-600 px-3 py-1 rounded text-xs">Approve</button>
              <button onClick={() => onReject(b.id)} className="bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-xs">Reject</button>
            </div>
          )}
          {b.status === 'approved' && <span className="text-green-400 text-xs">✅ Approved</span>}
          {b.status === 'rejected' && <span className="text-red-400 text-xs">❌ Rejected</span>}
        </div>
      ))}
    </div>
  )
}
