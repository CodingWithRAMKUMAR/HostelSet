import { formatDate, formatCurrency } from '../../lib/utils'

export default function TenantsTable({ tenants, paginate, currentPage, setCurrentPage, itemsPerPage, totalItems }) {
  return (
    <div className="bg-gray-900 rounded-2xl shadow-xl overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-800 border-b border-gray-700">
          <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Phone</th><th className="px-4 py-3 text-left">Room</th><th className="px-4 py-3 text-left">Property</th><th className="px-4 py-3 text-left">Move‑in</th><th className="px-4 py-3 text-left">Rent</th><th className="px-4 py-3 text-left">Status</th></tr>
        </thead>
        <tbody>
          {paginate(tenants).map(t => (
            <tr key={t.id} className="border-b border-gray-800">
              <td className="px-4 py-3">{t.name}</td>
              <td className="px-4 py-3">{t.phone}</td>
              <td className="px-4 py-3">{t.rooms?.room_number || 'N/A'}</td>
              <td className="px-4 py-3">{t.properties?.name || 'N/A'}</td>
              <td className="px-4 py-3">{formatDate(t.move_in_date)}</td>
              <td className="px-4 py-3">{formatCurrency(t.rent_amount)}</td>
              <td className="px-4 py-3">{t.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between p-4">
        <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50">Prev</button>
        <span>Page {currentPage} of {Math.ceil(totalItems/itemsPerPage)}</span>
        <button onClick={() => setCurrentPage(p => p+1)} disabled={currentPage>=Math.ceil(totalItems/itemsPerPage)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50">Next</button>
      </div>
    </div>
  )
}
