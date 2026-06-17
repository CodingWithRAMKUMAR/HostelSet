import { formatCurrency, formatDate, getSharingDetails } from '../../../lib/utils'

export default function RoomDetailsModal({ room, tenantsInRoom, onClose, onHistory, onProfile, isSubmitting }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Room {room?.room_number} Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-slate-800 mb-3">Room Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Room Number:</span>
                <span className="font-semibold text-slate-700">{room?.room_number}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Sharing Type:</span>
                <span className="font-semibold text-slate-700">{getSharingDetails(room?.sharing_type)?.label}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Monthly Rent:</span>
                <span className="font-semibold text-slate-700">{formatCurrency(room?.monthly_rent)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Capacity:</span>
                <span className="font-semibold text-slate-700">{room?.capacity} persons</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Current Occupants:</span>
                <span className="font-semibold text-slate-700">{room?.current_occupants}</span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 mb-3">Current Residents</h3>
            <div className="space-y-3">
              {tenantsInRoom?.length > 0 ? (
                tenantsInRoom.map(tenant => (
                  <div key={tenant.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-slate-800">{tenant.name}</p>
                        <p className="text-xs text-gray-500">📞 {tenant.phone}</p>
                        <p className="text-xs text-gray-500 mt-1">Move-in: {formatDate(tenant.move_in_date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-700">{formatCurrency(tenant.rent_amount)}/month</p>
                        <p className={`text-xs ${tenant.rent_status === 'paid' ? 'text-green-500' : 'text-red-500'}`}>
                          {tenant.rent_status === 'paid' ? '✅ Paid' : '⚠️ Pending'}
                        </p>
                        <div className="flex gap-1 mt-1">
                          <button onClick={() => onHistory(tenant)} disabled={isSubmitting} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
                            📜 History
                          </button>
                          <button onClick={() => onProfile(tenant)} disabled={isSubmitting} className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 disabled:opacity-50">
                            👤 Profile
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-4">No residents currently</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
