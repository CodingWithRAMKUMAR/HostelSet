import { formatCurrency } from '../../../lib/utils'

export default function CollectRentModal({ tenant, paymentAmount, setPaymentAmount, onCollect, onCancel, isSubmitting, getRoomNumberById }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { if (!isSubmitting) onCancel() }}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">Collect Rent</h2>
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <p className="font-semibold">{tenant?.name}</p>
          <p className="text-sm text-gray-500">Room {tenant?.room_number || getRoomNumberById(tenant?.room_id)}</p>
          <p>Monthly Rent: {formatCurrency(tenant?.rent_amount)}</p>
          <p className="text-red-500">Pending: {formatCurrency(tenant?.pending_amount || tenant?.rent_amount)}</p>
        </div>
        <input
          type="number"
          placeholder="Enter Amount (₹)"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4"
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(parseInt(e.target.value || 0, 10))}
        />
        <div className="flex gap-3">
          <button onClick={onCollect} disabled={isSubmitting} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
            {isSubmitting ? 'Processing...' : 'Collect'}
          </button>
          <button onClick={onCancel} disabled={isSubmitting} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold disabled:opacity-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
