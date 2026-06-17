import { useState } from 'react'
import { formatCurrency, getSharingDetails } from '../../lib/utils'

export default function RoomList({ rooms, tenants, vacateRequests, roomMonthlyIncome, onRoomClick, onDeleteRoom, isSubmitting }) {
  const getRoomNumberById = (roomId) => {
    const room = rooms.find(r => r.id === roomId)
    return room ? room.room_number : 'N/A'
  }

  const getTenantsInRoom = (roomId) => {
    return tenants.filter(t => t.room_id === roomId)
  }

  const getUpcomingVacateForRoom = (roomId) => {
    const vacate = vacateRequests.find(v => v.room_id === roomId && v.status === 'approved')
    if (!vacate) return null
    const tenant = tenants.find(t => t.id === vacate.tenant_id)
    if (!tenant || tenant.room_id !== vacate.room_id) return null
    const vacateDate = new Date(vacate.expected_check_out)
    const today = new Date()
    const daysLeft = Math.ceil((vacateDate - today) / (1000 * 60 * 60 * 24))
    if (daysLeft < 0) return { date: vacate.expected_check_out, daysLeft: 0, overdue: true }
    return { date: vacate.expected_check_out, daysLeft, overdue: false }
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl">
        <div className="text-5xl mb-3">🏠</div>
        <p className="text-gray-500">No rooms added yet</p>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {rooms.map((room) => {
        const sharing = getSharingDetails(room.sharing_type)
        const isFull = room.current_occupants >= room.capacity
        const availableSlots = room.capacity - room.current_occupants
        const roomTenants = getTenantsInRoom(room.id)
        const upcomingVacate = getUpcomingVacateForRoom(room.id)
        const allPaid = roomTenants.length > 0 && roomTenants.every(t => t.rent_status === 'paid')
        const monthlyCollected = roomMonthlyIncome[room.id] || 0
        return (
          <div
            key={room.id}
            onClick={() => onRoomClick(room)}
            className={`bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100 overflow-hidden relative ${isFull ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-gradient-to-br from-slate-50 to-gray-50'}`}
          >
            {upcomingVacate && (
              <div className={`absolute top-2 right-2 z-10 px-2 py-1 rounded-full text-xs font-bold ${upcomingVacate.daysLeft <= 3 ? 'bg-red-500 text-white animate-pulse' : 'bg-orange-500 text-white'}`}>
                🚪 Vacates {upcomingVacate.daysLeft > 0 ? `in ${upcomingVacate.daysLeft} days` : 'overdue'}
              </div>
            )}
            <div className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">Room {room.room_number}</h3>
                  <p className="text-sm text-gray-500 mt-1">{sharing.label} {sharing.icon}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${isFull ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>
                    {isFull ? 'Full' : `${availableSlots} slot available`}
                  </div>
                  {roomTenants.length > 0 && (
                    <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${allPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {allPaid ? 'All Paid' : 'Pending'}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-slate-800">{formatCurrency(room.monthly_rent)}<span className="text-sm text-gray-400">/month</span></p>
                <div className="mt-2 inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                  This month: ₹{monthlyCollected.toLocaleString()}
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Occupancy</span>
                  <span className="text-slate-600">{room.current_occupants}/{room.capacity}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div className="h-2 rounded-full bg-gradient-to-r from-slate-600 to-slate-500" style={{ width: `${(room.current_occupants / room.capacity) * 100}%` }}></div>
                </div>
              </div>
              {roomTenants.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">Current Residents:</p>
                  <div className="flex -space-x-2">
                    {roomTenants.slice(0,3).map((tenant, idx) => (
                      <div key={tenant.id} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 border-2 border-white">
                        {tenant.name.charAt(0)}
                      </div>
                    ))}
                    {roomTenants.length > 3 && (
                      <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold text-slate-700 border-2 border-white">
                        +{roomTenants.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-3 pt-2 flex justify-end">
                <button onClick={(e) => { e.stopPropagation(); onDeleteRoom(room.id) }} disabled={isSubmitting} className="text-red-400 hover:text-red-600 text-xs disabled:opacity-50">
                  Delete Room
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
