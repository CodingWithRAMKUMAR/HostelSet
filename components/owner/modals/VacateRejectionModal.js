export default function VacateRejectionModal({ request, reason, setReason, onReject, onCancel, isSubmitting }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-2">Reject Vacate Request</h2>
        <p className="text-sm text-gray-600 mb-4">{request?.tenant_name || 'Tenant'} · Room {request?.room_number || 'N/A'}</p>
        <label className="block text-sm text-gray-600 mb-2" htmlFor="vacate-rejection-reason">Reason for rejection (optional)</label>
        <textarea
          id="vacate-rejection-reason"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl"
          rows="3"
          maxLength={2000}
          placeholder="Enter a reason that will be shown to the tenant"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <div className="flex gap-3 mt-6">
          <button onClick={onReject} disabled={isSubmitting} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
            {isSubmitting ? 'Rejecting…' : 'Confirm Reject'}
          </button>
          <button onClick={onCancel} disabled={isSubmitting} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold disabled:opacity-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}
