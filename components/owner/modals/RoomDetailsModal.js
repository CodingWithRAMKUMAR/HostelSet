import { motion } from 'framer-motion';
import { formatCurrency, formatDate } from '../../../lib/utils';

export default function RoomDetailsModal({ 
  room, 
  tenantsInRoom, 
  onClose, 
  isSubmitting,
  getRoomNumberById,
  fetchTenantPayments,
  fetchTenantApplication
}) {
  if (!room) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1a1a1a] p-6 border-b-2 border-orange-500/80 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Room {room.room_number} Details
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white text-2xl transition"
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Left Column: Room Information */}
            <div>
              <h3 className="font-semibold text-lg text-gray-800 mb-4 border-b border-gray-200 pb-2">Room Information</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Room Number:</span>
                  <span className="font-medium text-gray-800">{room.room_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sharing Type:</span>
                  <span className="font-medium text-gray-800 capitalize">{room.sharing_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Monthly Rent:</span>
                  <span className="font-medium text-gray-800">{formatCurrency(room.monthly_rent)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Capacity:</span>
                  <span className="font-medium text-gray-800">{room.capacity} persons</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Occupants:</span>
                  <span className="font-medium text-gray-800">{room.current_occupants}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Current Residents */}
            <div>
              <h3 className="font-semibold text-lg text-gray-800 mb-4 border-b border-gray-200 pb-2">Current Residents</h3>
              {tenantsInRoom.length === 0 ? (
                <p className="text-gray-400 text-sm">No tenants currently in this room.</p>
              ) : (
                <div className="space-y-4">
                  {tenantsInRoom.map((tenant) => (
                    <div key={tenant.id} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-800">{tenant.name}</p>
                          <p className="text-xs text-gray-500">📞 {tenant.phone}</p>
                          <p className="text-xs text-gray-500">Move-in: {formatDate(tenant.move_in_date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">{formatCurrency(tenant.rent_amount)}<span className="text-xs text-gray-400 font-normal">/month</span></p>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            tenant.rent_status === 'paid' ? 'bg-green-100 text-green-700' :
                            tenant.rent_status === 'overdue' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {tenant.rent_status === 'pending' ? 'Pending' : tenant.rent_status}
                          </span>
                        </div>
                      </div>

                      {/* SAFE BUTTONS: Prevents 'i is not a function' crash */}
                      <div className="flex gap-2 mt-3">
                        <button 
                          onClick={() => {
                            if (typeof fetchTenantPayments === 'function') {
                              fetchTenantPayments(tenant);
                            } else {
                              console.warn("fetchTenantPayments is not available");
                            }
                          }} 
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium transition"
                        >
                          History
                        </button>
                        <button 
                          onClick={() => {
                            if (typeof fetchTenantApplication === 'function') {
                              fetchTenantApplication(tenant);
                            } else {
                              console.warn("fetchTenantApplication is not available");
                            }
                          }} 
                          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-xs font-medium transition"
                        >
                          Profile
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex justify-end">
          <button 
            onClick={onClose} 
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium transition"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}