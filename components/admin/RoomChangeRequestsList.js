import { formatDate } from '../../lib/utils'

export default function RoomChangeRequestsList({ requests, onApprove, onReject }) {
  if (!requests.length) return <p className="text-center text-gray-500">No room change requests</p>
  return (
    <div className="space-y-4">
      {requests.map(req => (
        <div key={req.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold">{req.tenants?.name || 'Unknown'}</p>
              <p className="text-sm text-gray-400">From Room {req.old_room?.room_number} → To Room {req.new_room?.room_number}</p>
              {req.reason && <p className="text-sm text-gray-500">Reason: {req.reason}</p>}
              <p className="text-xs text-gray-500">Requested: {formatDate(req.requested_at)}</p>
            </div>
            {req.status === 'pending' && (
              <div className="flex gap-2">
                <button onClick={() => onApprove(req.id)} className="bg-green-700 hover:bg-green-600 px-3 py-1 rounded text-xs">Approve</button>
                <button onClick={() => onReject(req.id)} className="bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-xs">Reject</button>
              </div>
            )}
            {req.status === 'approved' && <span className="text-green-400 text-xs">✅ Approved</span>}
            {req.status === 'rejected' && <span className="text-red-400 text-xs">❌ Rejected: {req.rejection_reason}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
