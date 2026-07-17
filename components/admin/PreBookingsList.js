import { formatDate, formatCurrency } from '../../lib/utils'

export default function PreBookingsList({ bookings = [], onApprove, onReject }) {
  if (!bookings.length) return <p className="text-center text-gray-500">No pre-bookings</p>
  const reservedCountsByRoom = bookings.reduce((counts, booking) => {
    if (booking.status === 'reserved') counts[booking.room_id] = (counts[booking.room_id] || 0) + 1
    return counts
  }, {})

  return (
    <div className="space-y-4">
      {bookings.map(booking => {
        const capacity = Number(booking.rooms?.capacity || 0)
        const activeReservations = Number(reservedCountsByRoom[booking.room_id] || 0)
        const reservationCapacityReached = capacity > 0 && activeReservations >= capacity
        return (
          <div key={booking.id} className="flex items-start justify-between rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div>
              <p className="font-semibold">{booking.name}</p>
              <p className="text-sm text-gray-400">{booking.phone} | {booking.email}</p>
              <p className="text-sm">Room {booking.rooms?.room_number} - {booking.rooms?.properties?.name}</p>
              <p className="text-sm text-gray-400">{activeReservations} of {capacity || 'N/A'} future reservation slots used</p>
              <p className="text-sm">Expected move-in: {formatDate(booking.expected_move_in_date)}</p>
              <p className="text-sm">Pre-booking fee: {formatCurrency(booking.pre_booking_fee_amount)}</p>
              <p className="text-xs text-gray-500">Status: {booking.status} | Payment: {booking.payment_status}</p>
              {booking.payment_screenshot && <a href={booking.payment_screenshot} target="_blank" rel="noreferrer" className="text-xs text-purple-400">View Screenshot</a>}
            </div>
            {booking.status === 'pending' && (
              <div className="flex gap-2">
                <button disabled={reservationCapacityReached} onClick={() => onApprove(booking.id)} className="rounded bg-green-700 px-3 py-1 text-xs hover:bg-green-600 disabled:opacity-50">{reservationCapacityReached ? 'Capacity reached' : 'Reserve'}</button>
                <button onClick={() => onReject(booking.id)} className="rounded bg-red-700 px-3 py-1 text-xs hover:bg-red-600">Reject</button>
              </div>
            )}
            {booking.status === 'reserved' && <span className="text-xs text-purple-400">Reserved - waiting for vacancy</span>}
            {booking.status === 'converted' && <span className="text-xs text-green-400">Converted</span>}
            {booking.status === 'rejected' && <span className="text-xs text-red-400">Rejected</span>}
          </div>
        )
      })}
    </div>
  )
}
