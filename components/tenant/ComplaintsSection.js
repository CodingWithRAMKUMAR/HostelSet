import { formatDate } from '../../lib/utils'

export default function ComplaintsSection({
  complaints = [],
  onDelete = () => {},
  onRaiseNew = () => {},
  isSubmitting = false,
}) {
  if (!complaints || complaints.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-3">📝</div>
        <p>No complaints filed yet</p>
        <button onClick={onRaiseNew} className="mt-3 text-slate-600 underline">Raise a complaint</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {complaints.map(complaint => (
        <div key={complaint.id} className="bg-white rounded-xl border p-5 shadow-sm relative group">
          <button
            onClick={() => onDelete(complaint.id)}
            disabled={isSubmitting}
            className="absolute top-4 right-4 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
          >
            🗑️ Delete
          </button>
          <div className="flex justify-between items-start mb-3 pr-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold">{complaint.title}</h3>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  complaint.priority === 'high' ? 'bg-red-100 text-red-700' :
                  complaint.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {complaint.priority}
                </span>
              </div>
              <p className="text-gray-600">{complaint.description}</p>
              {complaint.admin_response && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 font-semibold mb-1">Owner's Response:</p>
                  <p className="text-sm text-gray-700">{complaint.admin_response}</p>
                </div>
              )}
            </div>
            <span className={`px-2 py-1 rounded-full text-xs ${
              complaint.status === 'open' ? 'bg-red-100 text-red-700' :
              complaint.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {complaint.status === 'open' ? 'Open' :
               complaint.status === 'in_progress' ? 'In Progress' :
               'Resolved'}
            </span>
          </div>
          <p className="text-xs text-gray-400">Submitted: {formatDate(complaint.created_at)}</p>
        </div>
      ))}
    </div>
  )
}
