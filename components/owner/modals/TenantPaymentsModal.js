import { formatCurrency, formatDate } from '../../../lib/utils'

export default function TenantPaymentsModal({ tenant, payments, onClose, onViewScreenshot }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Payment History – {tenant?.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
        </div>
        {payments?.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No payment records found.</p>
        ) : (
          <div className="space-y-4">
            {payments.map(pay => (
              <div key={pay.id} className="border rounded-xl p-4 bg-gray-50">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <p className="font-semibold">{formatCurrency(pay.amount)}</p>
                    <p className="text-sm text-gray-500">Date: {formatDate(pay.payment_date)}</p>
                    <p className="text-sm text-gray-500">Method: {pay.payment_method}</p>
                    <p className="text-sm text-gray-500">Status: {pay.status}</p>
                    {pay.upi_transaction_id && <p className="text-xs text-gray-400">UTR: {pay.upi_transaction_id}</p>}
                  </div>
                  {pay.payment_screenshot && (
                    <div>
                      <button onClick={() => onViewScreenshot(pay.payment_screenshot)}>
                        <img src={pay.payment_screenshot} alt="Screenshot" className="w-24 h-24 object-cover rounded-lg border cursor-pointer hover:opacity-80" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
