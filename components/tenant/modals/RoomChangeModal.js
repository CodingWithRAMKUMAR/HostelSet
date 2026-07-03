import { formatCurrency, getSharingDetails } from '../../../lib/utils'
import { useModalAccessibility } from '../../../hooks/useModalAccessibility'

export default function RoomChangeModal({
  availableRooms = [],
  selectedNewRoom,
  setSelectedNewRoom,
  roomChangeReason,
  setRoomChangeReason,
  isSubmitting,
  onSubmit,
  onCancel,
}) {
  const dialogRef = useModalAccessibility(onCancel, isSubmitting)
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { if (!isSubmitting) onCancel() }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="room-change-modal-title" className="bg-white rounded-2xl max-w-md w-full p-6 outline-none" onClick={(e) => e.stopPropagation()}>
        <h2 id="room-change-modal-title" className="text-2xl font-bold mb-4">🔄 Request Room Change</h2>
        <p className="text-sm text-gray-600 mb-4">Select a new room from the same property. Owner will review and approve.</p>
        <div className="space-y-4">
          <select 
            className="w-full px-4 py-3 border border-gray-200 rounded-xl"
            value={selectedNewRoom}
            onChange={(e) => setSelectedNewRoom(e.target.value)}
          >
            <option value="">Select a room</option>
            {availableRooms.map(room => (
              <option key={room.id} value={room.id}>
                Room {room.room_number} - {getSharingDetails(room.sharing_type)?.label} - {formatCurrency(room.monthly_rent)}/month ({Math.max(0, (room.capacity || 0) - (room.current_occupants || 0))} slots available)
              </option>
            ))}
          </select>
          <textarea
            placeholder="Reason for room change (optional)"
            rows="3"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl"
            value={roomChangeReason}
            onChange={(e) => setRoomChangeReason(e.target.value)}
          />
          <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800">
            ⚠️ Your request will be sent to the owner for approval. You will be notified when the owner responds.
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onSubmit} disabled={isSubmitting || !selectedNewRoom} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
            <button onClick={onCancel} disabled={isSubmitting} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold disabled:opacity-50">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}
