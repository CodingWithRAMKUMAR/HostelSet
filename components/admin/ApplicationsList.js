import { formatDate } from '../../lib/utils'

export default function ApplicationsList({ applications, onApprove, onReject }) {
  if (!applications.length) return <p className="text-center text-gray-500">No pending applications</p>
  return (
    <div className="space-y-4">
      {applications.map(app => (
        <div key={app.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex justify-between items-start">
          <div>
            <p className="font-semibold">{app.name}</p>
            <p className="text-sm text-gray-400">📞 {app.phone}</p>
            <p className="text-xs text-gray-500">Applied: {formatDate(app.created_at)}</p>
            {app.message && <p className="text-sm text-gray-500">💬 {app.message}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onApprove(app.id)} className="bg-green-700 hover:bg-green-600 px-3 py-1 rounded text-xs">Approve</button>
            <button onClick={() => onReject(app.id)} className="bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-xs">Reject</button>
          </div>
        </div>
      ))}
    </div>
  )
}
