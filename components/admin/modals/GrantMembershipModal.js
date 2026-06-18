export default function GrantMembershipModal({ ownerName, grantDuration, setGrantDuration, onGrant, onCancel, isSubmitting }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-800" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">Grant Membership</h2>
        <p>Owner: <strong>{ownerName}</strong></p>
        <div className="my-4">
          <label>Duration (days)</label>
          <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white" value={grantDuration} onChange={e => setGrantDuration(parseInt(e.target.value) || 30)} min={1} />
        </div>
        <div className="flex gap-3">
          <button onClick={onGrant} disabled={isSubmitting} className="bg-purple-700 hover:bg-purple-600 text-white py-2 rounded-lg flex-1">Grant</button>
          <button onClick={onCancel} className="border border-gray-700 py-2 rounded-lg flex-1">Cancel</button>
        </div>
      </div>
    </div>
  )
}
