import { formatCurrency, formatDate } from '../../lib/utils'

export default function RoomChangeRequestList({ requests, onApprove, onReject, isSubmitting }) {
  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl">
        <div className="text-5xl mb-3">🔄</div>
        <p className="text-gray-500">No pending room change requests</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {requests.map(request => {
        const tenant = request.tenants
        const oldRoom = request.old_room
        const newRoom = request.new_room
        return (
          <div key={request.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">Pending</span>
                  <span className="text-xs text-gray-400">{formatDate(request.requested_at)}</span>
                </div>
                <h3 className="font-bold text-lg text-slate-800">{tenant?.name || 'Unknown'}</h3>
                <p className="text-sm text-gray-500">Current Room: <span className="font-medium">Room {oldRoom?.room_number || 'N/A'}</span></p>
                <p className="text-sm text-gray-500">Requested Room: <span className="font-medium">Room {newRoom?.room_number || 'N/A'}</span> (Capacity: {newRoom?.capacity}, Current occupants: {newRoom?.current_occupants})</p>
                {request.reason && (
                  <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                    <span className="font-semibold">Reason:</span> {request.reason}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">Rent difference: {formatCurrency((newRoom?.monthly_rent || 0) - (tenant?.rent_amount || 0))}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onApprove(request)}
                  disabled={isSubmitting}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => onReject(request)}
                  disabled={isSubmitting}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
