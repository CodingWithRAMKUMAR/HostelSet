import { formatCurrency, formatDate } from '../../lib/utils'

export default function PaymentHistoryTable({ payments, getRoomNumberById }) {
  if (!payments || payments.length === 0) {
    return <div className="text-center py-12 bg-gray-50 rounded-xl">No payment records</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Tenant</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Room</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Amount</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Method</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(p => (
            <tr key={p.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-500">{formatDate(p.payment_date)}</td>
              <td className="px-4 py-3 font-medium">{p.tenants?.name || 'N/A'}</td>
              <td className="px-4 py-3 text-gray-600">{p.tenants?.rooms?.room_number || getRoomNumberById(p.tenants?.room_id)}</td>
              <td className="px-4 py-3 font-semibold text-green-600">{formatCurrency(p.amount)}</td>
              <td className="px-4 py-3 capitalize text-gray-500">{p.payment_method}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  p.status === 'success' ? 'bg-green-100 text-green-700' :
                  p.status === 'payment_pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {p.status === 'success' ? 'Success' : p.status === 'payment_pending' ? 'Pending' : p.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
