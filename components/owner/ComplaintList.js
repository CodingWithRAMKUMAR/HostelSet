import { formatDate } from '../../lib/utils';
import { useRealtimeData } from '../../hooks/useRealtimeData';

export default function ComplaintList({ onRespond = () => {}, onResolve = () => {}, isSubmitting = false }) {
  // Use the hook to fetch and listen to 'complaints' in real-time
  const { data: complaints, loading } = useRealtimeData('complaints');

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading complaints...</div>;
  }

  if (!complaints || complaints.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl">
        <div className="text-5xl mb-3">✅</div>
        <p className="text-gray-500">No complaints to review</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {complaints.map(c => (
        <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">{c.priority || 'Medium'}</span>
                <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
              </div>
              <h3 className="font-semibold text-slate-800">{c.title}</h3>
              <p className="text-sm text-gray-500 mt-1">From: {c.tenant_name}</p>
              <p className="text-gray-600 mt-2">{c.description}</p>
              {c.admin_response && <p className="text-sm text-green-600 mt-2 bg-green-50 p-2 rounded">Response: {c.admin_response}</p>}
            </div>
            <div className="flex gap-2">
              {c.status === 'open' && (
                <button onClick={() => onRespond(c)} disabled={isSubmitting} className="bg-slate-800 text-white px-3 py-1 rounded text-sm disabled:opacity-50">Respond</button>
              )}
              {c.status === 'in_progress' && (
                <button onClick={() => onResolve(c.id)} disabled={isSubmitting} className="bg-green-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50">Resolve</button>
              )}
            </div>
          </div>
          <div className="mt-3">
            <span className={`px-2 py-1 rounded-full text-xs ${c.status === 'open' ? 'bg-red-100 text-red-700' : c.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
              {c.status === 'open' ? 'Open' : c.status === 'in_progress' ? 'In Progress' : 'Resolved'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}