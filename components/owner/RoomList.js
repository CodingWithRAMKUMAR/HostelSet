// Cache clear update 2026-06-23
import { motion } from 'framer-motion';
import { formatCurrency, getSharingDetails } from '../../lib/utils';

export default function RoomList({ 
  rooms, 
  tenants, 
  vacateRequests, 
  roomMonthlyIncome, 
  onRoomClick, 
  onDeleteRoom, 
  isSubmitting 
}) {
  if (!rooms || rooms.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
        <div className="text-6xl mb-4">🏠</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No rooms added yet</h3>
        <p className="text-gray-400">Click "Add Room" to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {rooms.map((room) => {
        const sharing = getSharingDetails(room.sharing_type);
        const occupants = tenants.filter(t => t.room_id === room.id);
        const upcomingVacate = vacateRequests.find(v => v.room_id === room.id && v.status === 'approved');
        const vacateDays = upcomingVacate?.expected_check_out ? Math.ceil((new Date(`${upcomingVacate.expected_check_out}T23:59:59`) - new Date()) / 86400000) : null;
        const monthlyIncome = roomMonthlyIncome[room.id] || 0;

        return (
          <motion.div
            key={room.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all cursor-pointer group"
            onClick={() => onRoomClick(room)}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-50">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-[#1a1a1a]">Room {room.room_number}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {sharing?.label || 'Unknown'} {sharing?.icon}
                  </p>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${room.room_audience === 'boys' ? 'bg-blue-100 text-blue-700' : room.room_audience === 'girls' ? 'bg-pink-100 text-pink-700' : 'bg-violet-100 text-violet-700'}`}>{room.room_audience === 'boys' ? 'Boys Room' : room.room_audience === 'girls' ? 'Girls Room' : 'Co-living'}</span>
                </div>
                <div className="flex flex-col items-end">
                  {room.current_occupants >= room.capacity ? (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider">
                      Full
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full uppercase tracking-wider">
                      {room.capacity - room.current_occupants} slot available
                    </span>
                  )}
                  {upcomingVacate && (
                    <span className="mt-1 text-xs text-amber-600 font-medium">
                      {vacateDays > 1 ? `Vacates in ${vacateDays} days` : vacateDays === 1 ? 'Vacates tomorrow' : 'Ready to vacate'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-2xl font-bold text-[#1a1a1a]">{formatCurrency(room.monthly_rent)}</p>
                  <p className="text-xs text-gray-400">/month</p>
                  <p className="mt-1 text-xs text-gray-500">Application deposit: {formatCurrency(3000)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-600">{formatCurrency(monthlyIncome)}</p>
                  <p className="text-xs text-gray-400">this month</p>
                </div>
              </div>

              {/* Occupancy Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Occupancy</span>
                  <span>{room.current_occupants}/{room.capacity}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full transition-all duration-150"
                    style={{ width: `${(room.current_occupants / room.capacity) * 100}%` }}
                  />
                </div>
              </div>

              {/* Occupants Preview */}
              {occupants.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-50">
                  <p className="text-xs text-gray-400 mb-2">Current Residents:</p>
                  <div className="flex flex-wrap gap-2">
                    {occupants.slice(0, 3).map((t) => (
                      <div key={t.id} className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full text-xs">
                        <span className="w-5 h-5 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center text-[10px]">
                          {t.name?.charAt(0) || '?'}
                        </span>
                        <span className="text-gray-600">{t.name}</span>
                      </div>
                    ))}
                    {occupants.length > 3 && (
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full text-xs text-gray-500">
                        +{occupants.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Are you sure you want to delete Room ${room.room_number}?`)) {
                    onDeleteRoom(room.id);
                  }
                }}
                disabled={isSubmitting || room.current_occupants > 0}
                className={`text-xs font-semibold transition ${
                  room.current_occupants > 0 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : 'text-red-500 hover:text-red-700'
                }`}
              >
                {room.current_occupants > 0 ? 'Occupied - Cannot Delete' : 'Delete Room'}
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
