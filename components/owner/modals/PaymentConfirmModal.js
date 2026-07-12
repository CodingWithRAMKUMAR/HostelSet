export default function PaymentConfirmModal({ tenant, onConfirm, onCancel, isSubmitting, onViewScreenshot }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">Confirm Payment</h2>
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <p className="font-semibold">{tenant?.name || 'Tenant'}</p>
          <p className="text-sm text-gray-500">Room {tenant?.room_number || 'N/A'}</p>
          <p className="text-sm text-gray-500 mt-2">UPI Transaction ID: {tenant?.upi_transaction_id || 'N/A'}</p>
          {tenant?.payment_screenshot && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">Payment Screenshot:</p>
              <button onClick={() => onViewScreenshot({ record: tenant, field: 'payment_screenshot' })} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Open proof</button>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={onConfirm} disabled={isSubmitting} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
            {isSubmitting ? 'Confirming...' : '✅ Confirm Payment'}
          </button>
          <button onClick={onCancel} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
