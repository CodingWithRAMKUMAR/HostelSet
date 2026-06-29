export default function MembershipModal({ onSelectPlan, onCancel, loading, pendingRequest }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-2">✨ Request Membership</h2>
        <p className="text-sm text-gray-500 mb-4">Choose a plan and send it to the HostelSet admin for approval. No online payment is collected.</p>
        {pendingRequest && <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">Your {pendingRequest.plan_id} request is awaiting admin approval.</div>}
        <div className="space-y-3">
          <button
            onClick={() => onSelectPlan('monthly', 499, 'Monthly')}
            disabled={loading || Boolean(pendingRequest)}
            className="w-full p-4 border rounded-xl text-left hover:bg-gray-50 transition disabled:opacity-50"
          >
            <div className="font-bold text-lg">Monthly Plan</div>
            <div className="text-sm text-gray-500">₹499 / month</div>
            <div className="text-xs text-gray-400 mt-1">✓ Basic support</div>
            <div className="text-xs text-gray-400">✓ Up to 50 tenants</div>
          </button>
          <button
            onClick={() => onSelectPlan('yearly', 4999, 'Yearly')}
            disabled={loading || Boolean(pendingRequest)}
            className="w-full p-4 border rounded-xl text-left hover:bg-gray-50 transition disabled:opacity-50"
          >
            <div className="font-bold text-lg">Yearly Plan</div>
            <div className="text-sm text-gray-500">₹4,999 / year</div>
            <div className="text-xs text-gray-400 mt-1">✓ Priority support</div>
            <div className="text-xs text-gray-400">✓ Unlimited tenants</div>
            <div className="text-xs text-gray-400">✓ Analytics dashboard</div>
          </button>
        </div>
        <button onClick={onCancel} className="w-full mt-4 py-2 text-gray-500 hover:text-gray-700 transition">
          Cancel
        </button>
      </div>
    </div>
  )
}
