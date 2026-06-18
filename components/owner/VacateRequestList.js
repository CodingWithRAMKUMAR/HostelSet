import { formatDate } from '../../lib/utils';
import { useRealtimeData } from '../../hooks/useRealtimeData';

export default function VacateRequestList({ onApprove = () => {}, isSubmitting = false }) {
  // Fetch and listen to vacate requests in real-time
  const { data: requests, loading } = useRealtimeData('vacate_requests');

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading requests...</div>;
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl">
        <div className="text-5xl mb-3">🚪</div>
        <p className="text-gray-500">No vacate requests</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map(req => {
        const expectedDate = new Date(req.expected_check_out);
        const today = new Date();
        const daysUntilVacate = Math.ceil((expectedDate - today) / (1000 * 60 * 60 * 24));
        const isPending = req.status === 'pending';
        
        return (
          <div key={req.id} className={`bg-white rounded-xl border p-4 ${daysUntilVacate <= 7 ? 'border-red-200 bg-red-50' : 'border-yellow-100'}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${daysUntilVacate <= 7 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {req.status === 'approved' ? '✅ Approved' : (daysUntilVacate <= 7 ? `⚠️ ${daysUntilVacate} days left` : 'Pending')}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(req.requested_date)}</span>
                </div>
                <h3 className="font-semibold text-slate-800">{req.tenant_name}</h3>
                <p className="text-sm text-gray-500">Room {req.room_number}</p>
                <p className="text-sm text-gray-600 mt-1">Expected: {formatDate(req.expected_check_out)}</p>
                {req.reason && <p className="text-sm text-gray-500 mt-1">Reason: {req.reason}</p>}
              </div>
              {isPending && (
                <button
                  onClick={() => onApprove(req.id, req.tenant_id, req.room_id, req.expected_check_out)}
                  disabled={isSubmitting}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-700 transition disabled:opacity-50"
                >
                  Approve
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}