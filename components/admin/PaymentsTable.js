import { formatDate, formatCurrency } from '../../lib/utils'

export default function PaymentsTable({ payments, paginate, currentPage, setCurrentPage, itemsPerPage, totalItems }) {
  return (
    <div className="bg-gray-900 rounded-2xl shadow-xl overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-800 border-b border-gray-700">
          <tr><th className="px-4 py-3">Date</th><th>Tenant</th><th>Amount</th><th>Method</th><th>Status</th></tr>
        </thead>
        <tbody>
          {paginate(payments).map(p => (
            <tr key={p.id} className="border-b border-gray-800">
              <td className="px-4 py-3">{formatDate(p.payment_date)}</td>
              <td className="px-4 py-3">{p.tenants?.name}</td>
              <td className="px-4 py-3 text-green-400">{formatCurrency(p.amount)}</td>
              <td className="px-4 py-3 capitalize">{p.payment_method}</td>
              <td className="px-4 py-3"><span className="px-2 py-1 bg-green-800 text-green-200 rounded-full text-xs">{p.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
