export default function ComplaintResponseModal({ complaint, response, setResponse, onSend, onCancel, isSubmitting }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">Respond to Complaint</h2>
        <p className="text-sm text-gray-500 mb-2">From: {complaint?.tenant_name}</p>
        <p className="text-sm text-gray-600 mb-4">"{complaint?.title}"</p>
        <textarea
          placeholder="Your response..."
          rows="4"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
        />
        <div className="flex gap-3">
          <button onClick={onSend} disabled={isSubmitting} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
            Send Response
          </button>
          <button onClick={onCancel} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
