export default function RoomChangeReasonModal({ reason, setReason, onReject, onCancel, isSubmitting }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">Reject Room Change</h2>
        <p className="text-sm text-gray-600 mb-2">Reason for rejection (this will be shown to the tenant):</p>
        <textarea
          className="w-full px-4 py-3 border border-gray-200 rounded-xl"
          rows="3"
          placeholder="E.g., Room already taken, tenant not eligible, etc."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-3 mt-6">
          <button onClick={onReject} disabled={isSubmitting || !reason.trim()} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
            {isSubmitting ? 'Rejecting…' : 'Confirm Reject'}
          </button>
          <button onClick={onCancel} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
