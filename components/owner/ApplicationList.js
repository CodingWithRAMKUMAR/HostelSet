import { formatDate } from '../../lib/utils';
import { useRealtimeData } from '../../hooks/useRealtimeData'; // Import your new hook

export default function ApplicationList({ onApprove = () => {}, onResendEmail = () => {}, isSubmitting = false }) {
  // Use the hook to fetch and listen to 'applications' in real-time
  // Note: Adjust the filter if you need to show only specific properties (e.g., {column: 'owner_id', value: currentOwnerId})
  const { data: applications, loading } = useRealtimeData('applications'); 

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading applications...</div>;
  }

  if (!applications || applications.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl">
        <div className="text-5xl mb-3">📋</div>
        <p className="text-gray-500">No pending applications</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {applications.map(app => (
        <div key={app.id} className="bg-white rounded-xl border border-gray-100 p-4 flex justify-between items-center hover:shadow-md transition">
          <div>
            <h3 className="font-semibold text-slate-800">{app.name}</h3>
            <p className="text-sm text-gray-500">📞 {app.phone}</p>
            {app.message && <p className="text-sm text-gray-600 mt-1">💬 {app.message}</p>}
            <p className="text-xs text-gray-400 mt-1">Applied: {formatDate(app.created_at)}</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => onApprove(app.id)} 
              disabled={isSubmitting} 
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
            >
              Approve →
            </button>
            <button 
              onClick={() => onResendEmail(app.email)} 
              disabled={isSubmitting} 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              📧 Resend
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}