import { memo } from 'react'
import { formatCurrency, formatDate } from '../../lib/utils'

const PaymentsSection = ({ payments = [], onViewScreenshot = () => {} }) => {
  if (!payments || payments.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-3">💰</div>
        <p>No payment history yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Amount</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Method</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">UTR</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Screenshot</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-b hover:bg-gray-50 transition">
                <td className="px-4 py-3 text-sm text-gray-600">{formatDate(payment.payment_date)}</td>
                <td className="px-4 py-3 font-semibold text-green-600">{formatCurrency(payment.amount)}</td>
                <td className="px-4 py-3 text-sm text-gray-500 capitalize">{payment.payment_method}</td>
                <td className="px-4 py-3 text-xs text-gray-500 font-mono">{payment.upi_transaction_id || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    payment.status === 'success' ? 'bg-green-100 text-green-700' :
                    payment.status === 'payment_pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {payment.status === 'success' ? 'Success' :
                     payment.status === 'payment_pending' ? 'Pending' :
                     payment.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {payment.payment_screenshot ? (
                    <button
                      onClick={() => onViewScreenshot(payment.payment_screenshot)}
                      className="text-blue-600 hover:text-blue-800 text-sm underline"
                    >
                      View
                    </button>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default memo(PaymentsSection)
