export default function RejectReasonModal({ reason, setReason, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-800" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">Rejection Reason</h2>
        <textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 h-24" value={reason} onChange={e => setReason(e.target.value)} placeholder="Why are you rejecting this?" />
        <div className="flex gap-3 mt-4">
          <button onClick={onConfirm} className="bg-red-700 hover:bg-red-600 text-white py-2 rounded-lg flex-1">Confirm Reject</button>
          <button onClick={onCancel} className="border border-gray-700 py-2 rounded-lg flex-1">Cancel</button>
        </div>
      </div>
    </div>
  )
}
