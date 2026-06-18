import { formatCurrency } from '../../lib/utils'

export default function OwnerSettingsTable({ settings, onEdit }) {
  return (
    <div className="bg-gray-900 rounded-2xl shadow-xl overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-800 border-b">
          <tr><th>Owner</th><th>UPI ID</th><th>UPI Phone</th><th>Joining Fee</th><th>Advance Months</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {settings.map(os => (
            <tr key={os.owner_id} className="border-b border-gray-800">
              <td className="px-4 py-3">{os.users?.full_name}</td>
              <td>{os.upi_id || '—'}</td>
              <td>{os.upi_phone || '—'}</td>
              <td>{formatCurrency(os.joining_fee || 0)}</td>
              <td>{os.advance_months || 1}</td>
              <td><button onClick={() => onEdit(os)} className="text-blue-400 text-sm">Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
