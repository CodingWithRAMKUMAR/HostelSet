import { formatCurrency, formatDate } from '../../lib/utils'

const statusTone = {
  pending: 'bg-amber-100 text-amber-700',
  reserved: 'bg-purple-100 text-purple-700',
  converted: 'bg-emerald-100 text-emerald-700',
}

export default function PreBookingList({
  bookings = [],
  onApprove = () => {},
  onReject = () => {},
  onConvert = () => {},
  onViewScreenshot = () => {},
  isSubmitting = false,
}) {
  const visibleBookings = bookings.filter(booking => ['pending', 'reserved', 'converted'].includes(booking.status))
  const reservedCountsByRoom = visibleBookings.reduce((counts, booking) => {
    if (booking.status !== 'reserved') return counts
    counts[booking.room_id] = (counts[booking.room_id] || 0) + 1
    return counts
  }, {})
  const earliestReservedByRoom = visibleBookings
    .filter(booking => booking.status === 'reserved')
    .sort((a, b) =>
      String(a.reserved_at || '').localeCompare(String(b.reserved_at || '')) ||
      String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
      String(a.id).localeCompare(String(b.id))
    )
    .reduce((first, booking) => {
      if (!first[booking.room_id]) first[booking.room_id] = booking.id
      return first
    }, {})

  if (visibleBookings.length === 0) {
    return <div className="rounded-xl bg-gray-50 py-12 text-center">No pre-bookings waiting for review.</div>
  }

  return (
    <div className="space-y-4">
      {visibleBookings.map(booking => {
        const amountPaid = booking.pre_booking_fee_amount || 0
        const capacity = Number(booking.rooms?.capacity || 0)
        const activeReservations = Number(reservedCountsByRoom[booking.room_id] || 0)
        const reservationCapacityReached = capacity > 0 && activeReservations >= capacity
        const roomIsVacant = Number(booking.rooms?.current_occupants || 0) < capacity
        const isNextReservation = earliestReservedByRoom[booking.room_id] === booking.id
        return (
          <div key={booking.id} className="flex flex-col items-start justify-between gap-4 rounded-xl border bg-white p-4 sm:flex-row">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{booking.name}</p>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusTone[booking.status] || 'bg-gray-100 text-gray-600'}`}>
                  {booking.status === 'reserved' ? 'Reserved - waiting for vacancy' : booking.status}
                </span>
                {booking.status === 'pending' && reservationCapacityReached && <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Reservation capacity reached</span>}
              </div>
              <p className="text-sm text-gray-500">Phone: {booking.phone}</p>
              <p className="text-sm text-gray-500">Email: {booking.email || 'No email'}</p>
              <p className="text-sm">Room: {booking.rooms?.room_number || 'N/A'}</p>
              <p className="text-sm text-gray-500">{activeReservations} of {capacity || 'N/A'} future reservation slots used</p>
              <p className="text-sm">Message: {booking.message || 'None'}</p>
              <p className="text-sm font-semibold text-green-600">Pre-booking amount: {formatCurrency(amountPaid)}</p>
              {booking.payment_screenshot && (
                <div className="mt-2">
                  <button type="button" onClick={() => onViewScreenshot(booking)} className="text-sm text-blue-600 underline">View Payment Screenshot</button>
                </div>
              )}
              {booking.payment_transaction_id && <p className="text-xs text-gray-400">UTR: {booking.payment_transaction_id}</p>}
              <p className="text-xs text-gray-400">Submitted: {formatDate(booking.created_at)}</p>
              {booking.reserved_at && <p className="text-xs text-gray-400">Reserved: {formatDate(booking.reserved_at)}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {booking.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => onApprove(booking.id, booking)}
                    disabled={isSubmitting || reservationCapacityReached}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                  >
                    Reserve
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(booking.id)}
                    disabled={isSubmitting}
                    className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}
              {booking.status === 'reserved' && (
                <button
                  type="button"
                  onClick={() => onConvert(booking.id, booking)}
                  disabled={isSubmitting || !roomIsVacant || !isNextReservation}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
                >
                  {roomIsVacant && isNextReservation ? 'Convert' : !isNextReservation ? 'Waiting in queue' : 'Waiting for vacancy'}
                </button>
              )}
              {booking.status === 'converted' && (
                <span className="rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">Tenant created</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
