import { formatCurrency, formatDate } from '../../lib/utils'

export default function RentPaymentsList({ payments = [], onConfirm = () => {}, onReject = () => {}, onViewScreenshot = () => {}, isSubmitting = false }) {
  if (!payments || payments.length === 0) {
    return <div className="text-center py-12 bg-gray-50 rounded-xl">No pending rent payments.</div>
  }

  return (
    <div className="space-y-4">
      {payments.map(p => (
        <div key={p.id} className="bg-white rounded-xl border p-4 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <p className="font-semibold">{p.tenants?.name || 'N/A'}</p>
            <p className="text-sm text-gray-500">Room {p.tenants?.rooms?.room_number || 'N/A'}</p>
            <p className="text-sm">Amount: {formatCurrency(p.amount)}</p>
            <p className="text-sm">Date: {formatDate(p.payment_date)}</p>
            {p.upi_transaction_id && <p className="text-xs text-gray-500">UTR: {p.upi_transaction_id}</p>}
            {p.payment_screenshot && (
              <div className="mt-2">
                <button onClick={() => onViewScreenshot(p.payment_screenshot)} className="text-blue-600 underline text-sm">View Screenshot</button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onConfirm(p.id, p.tenant_id, p.amount)} disabled={isSubmitting} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50">Received</button>
            <button onClick={() => onReject(p.id)} disabled={isSubmitting} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition disabled:opacity-50">Not Received</button>
          </div>
        </div>
      ))}
    </div>
  )
}
