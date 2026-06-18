import { motion } from 'framer-motion'
import { formatCurrency, getSharingDetails } from '../../../lib/utils'

export default function AddTenantModal({ formData, setFormData, rooms, onAdd, onCancel, isSubmitting }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">Add New Tenant</h2>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Full Name *"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
          <input
            type="tel"
            placeholder="Phone Number *"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            maxLength={10}
          />
          <input
            type="email"
            placeholder="Email Address * (required for login)"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
          />
          <input
            type="number"
            placeholder="Monthly Rent (₹) *"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl"
            value={formData.rent_amount}
            onChange={(e) => setFormData({...formData, rent_amount: parseInt(e.target.value || 0, 10)})}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Advance Months</label>
              <input
                type="number"
                placeholder="Advance Months"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                value={formData.advance_amount}
                onChange={(e) => setFormData({...formData, advance_amount: parseInt(e.target.value || 0, 10)})}
                min="0"
              />
              <p className="text-xs text-gray-400 mt-1">0 = no advance, due immediately</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Joining Fee (₹)</label>
              <input
                type="number"
                placeholder="Joining Fee (₹)"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                value={formData.joining_fee}
                onChange={(e) => setFormData({...formData, joining_fee: parseInt(e.target.value || 0, 10)})}
                min="0"
              />
            </div>
          </div>
          <select
            className="w-full px-4 py-3 border border-gray-200 rounded-xl"
            value={formData.room_id}
            onChange={(e) => setFormData({...formData, room_id: parseInt(e.target.value, 10)})}
          >
            <option value="">Select Room</option>
            {rooms.filter(r => r.current_occupants < r.capacity).map(room => (
              <option key={room.id} value={room.id}>
                Room {room.room_number} - {getSharingDetails(room.sharing_type)?.label} - {formatCurrency(room.monthly_rent)}/month ({room.capacity - room.current_occupants} slots left)
              </option>
            ))}
          </select>
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs text-blue-700">📌 After adding, tenant will receive a password set email. They can login with their email and set a password.</p>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onAdd} disabled={isSubmitting} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
              {isSubmitting ? 'Adding...' : 'Add Tenant'}
            </button>
            <button onClick={onCancel} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
