import { formatCurrency } from '../../lib/utils'

export default function RoomsTable({ rooms, onDelete }) {
  return (
    <div className="bg-gray-900 rounded-2xl shadow-xl overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-800 border-b border-gray-700">
          <tr><th>Room No.</th><th>Property</th><th>Sharing</th><th>Rent (₹)</th><th>Occupancy</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {rooms.map(room => (
            <tr key={room.id} className="border-b border-gray-800">
              <td className="px-4 py-3">{room.room_number}</td>
              <td className="px-4 py-3">{room.properties?.name}</td>
              <td className="px-4 py-3">{room.sharing_type}</td>
              <td className="px-4 py-3">{formatCurrency(room.monthly_rent)}</td>
              <td className="px-4 py-3">{room.current_occupants}/{room.capacity}</td>
              <td className="px-4 py-3"><button onClick={() => onDelete(room.id, `Room ${room.room_number}`)} className="text-red-400 text-sm">Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
