import { formatCurrency } from '../../../lib/utils'

export default function AddRoomModal({ roomForm, setRoomForm, sharingTypes, onAdd, onCancel, isSubmitting }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">Add New Room</h2>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Room Number *"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl"
            value={roomForm.room_number}
            onChange={(e) => setRoomForm({...roomForm, room_number: e.target.value})}
          />
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Room category *</label>
            <select className="w-full rounded-xl border border-gray-200 px-4 py-3" value={roomForm.room_audience} onChange={(e) => setRoomForm({...roomForm, room_audience: e.target.value})}>
              <option value="boys">Boys Room</option>
              <option value="girls">Girls Room</option>
              <option value="coliving">Co-living Room</option>
            </select>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Application security deposit: <strong>₹3,000</strong> for every room.</div>
          <select
            className="w-full px-4 py-3 border border-gray-200 rounded-xl"
            value={roomForm.sharing_type}
            onChange={(e) => {
              const selected = sharingTypes.find(t => t.value === e.target.value)
              setRoomForm({...roomForm, sharing_type: e.target.value, monthly_rent: selected.price})
            }}
          >
            {sharingTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label} {type.icon} - {formatCurrency(type.price)}/month
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Monthly Rent (₹) *"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl"
            value={roomForm.monthly_rent}
            onChange={(e) => setRoomForm({...roomForm, monthly_rent: parseInt(e.target.value || 0, 10)})}
          />
          <div className="flex gap-3 mt-6">
            <button onClick={onAdd} disabled={isSubmitting} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
              Add Room
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
