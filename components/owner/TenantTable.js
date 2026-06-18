import { memo } from 'react'
import { formatCurrency, formatDate } from '../../lib/utils'

function TenantTable({ tenants, vacateRequests = [], onCollect = () => {}, onHistory = () => {}, onProfile = () => {}, onDelete = () => {}, onConfirmPayment = () => {}, isSubmitting = false, getRoomNumberById = () => 'N/A', calculateRentDueStatus }) {
  if (!tenants || tenants.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl">
        <div className="text-5xl mb-3">👥</div>
        <p className="text-gray-500">No tenants found</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {tenants.map(t => {
        const due = calculateRentDueStatus ? calculateRentDueStatus(t) : { status: t.rent_status, message: '', daysUntilDue: null }
        const vacate = vacateRequests.find(v => v.tenant_id === t.id && v.status === 'approved')
        return (
          <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col md:flex-row md:justify-between md:items-center hover:shadow-md transition">
            <div>
              <h3 className="font-semibold text-slate-800">{t.name || 'Unnamed'}</h3>
              <p className="text-sm text-gray-500">Room {t.room_number || getRoomNumberById(t.room_id)}</p>
              <p className="text-xs text-gray-400 mt-1">Joined: {formatDate(t.move_in_date)}</p>
            </div>
            <div className="mt-3 md:mt-0 flex items-center gap-4">
              <div className="text-sm text-slate-800 font-semibold">{formatCurrency(t.pending_amount || 0)}</div>
              <div className={`px-2 py-1 rounded-full text-xs ${due.status === 'overdue' ? 'bg-red-100 text-red-700' : due.status === 'due_soon' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{due.status}</div>
              {vacate && <div className="text-xs text-gray-500">🚪 Vacate on {formatDate(vacate.expected_check_out)}</div>}
              <div className="flex gap-2">
                <button onClick={() => onCollect(t)} disabled={isSubmitting} className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50">Collect</button>
                <button onClick={() => onHistory(t)} className="bg-gray-100 px-3 py-1 rounded-lg text-sm">History</button>
                <button onClick={() => onProfile(t)} className="bg-blue-100 px-3 py-1 rounded-lg text-sm">Profile</button>
                <button onClick={() => onConfirmPayment(t)} className="bg-yellow-100 px-3 py-1 rounded-lg text-sm">Confirm</button>
                <button onClick={() => onDelete(t)} className="text-red-500 px-3 py-1 rounded-lg text-sm">Delete</button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default memo(TenantTable)
