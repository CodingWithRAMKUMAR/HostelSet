// Cache clear update 2026-06-23
import { motion } from 'framer-motion';
import { useState } from 'react';
import { formatCurrency, getSharingDetails } from '../../lib/utils';
import RoomActionMenu from './RoomActionMenu';

function ResidentAvatar({ tenant }) {
  const [failed, setFailed] = useState(false)
  if (tenant.profilePhotoUrl && !failed) {
    return <img src={tenant.profilePhotoUrl} alt={tenant.name ? `${tenant.name} profile photo` : 'Resident profile photo'} onError={() => setFailed(true)} className="h-5 w-5 shrink-0 rounded-full object-cover" title={tenant.name} />
  }
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white" title={tenant.name}>{tenant.name?.charAt(0) || '?'}</span>
}

export default function RoomList({ 
  rooms, 
  tenants, 
  vacateRequests, 
  roomMonthlyIncome, 
  onRoomClick, 
  onDeleteRoom, 
  isSubmitting 
}) {
  const [openRoomMenu, setOpenRoomMenu] = useState(null);
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
            className="max-w-full min-w-0 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition-all hover:shadow-md cursor-pointer group"
            onClick={() => onRoomClick(room)}
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold leading-tight text-slate-950">Room {room.room_number}</h3>
                <p className="mt-0.5 truncate text-xs leading-tight text-slate-500">
                  {sharing?.label || 'Unknown'} · {room.room_audience === 'boys' ? 'Boys' : room.room_audience === 'girls' ? 'Girls' : 'Co-living'}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold leading-5 ${room.current_occupants >= room.capacity ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                {room.current_occupants >= room.capacity ? 'Full' : `${room.capacity - room.current_occupants} open`}
              </span>
            </div>
            {upcomingVacate && <p className="mt-1 text-[11px] font-medium leading-tight text-amber-600">{vacateDays > 1 ? `Vacates in ${vacateDays} days` : vacateDays === 1 ? 'Vacates tomorrow' : 'Ready to vacate'}</p>}

            <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2">
              <div className="min-w-0">
                <p className="text-[11px] leading-tight text-slate-400">Monthly rent</p>
                <p className="truncate text-sm font-bold leading-tight text-slate-900">{formatCurrency(room.monthly_rent)}</p>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[11px] leading-tight text-slate-400">Deposit</p>
                <p className="truncate text-sm font-bold leading-tight text-slate-900">{formatCurrency(3000)}</p>
              </div>
            </div>

            <div className="mt-2">
              <div className="mb-1 flex justify-between text-[11px] leading-tight text-slate-500">
                <span>Occupancy</span>
                <span>{room.current_occupants}/{room.capacity}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all duration-150" style={{ width: `${Math.min(100, (room.current_occupants / room.capacity) * 100)}%` }} />
              </div>
            </div>

            <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                {occupants.slice(0, 3).map((t) => <ResidentAvatar key={t.id} tenant={t} />)}
                <span className="min-w-0 truncate text-[11px] text-slate-500">{occupants.length ? occupants.slice(0, 2).map(t => t.name).join(', ') : 'No residents'}{occupants.length > 2 ? ` +${occupants.length - 2}` : ''}</span>
              </div>
              <RoomActionMenu room={room} open={openRoomMenu === room.id} onToggle={open => setOpenRoomMenu(open ? room.id : null)} onEdit={onRoomClick} deleteDisabled={room.current_occupants > 0} disabled={isSubmitting} onDelete={selected => { if (confirm(`Are you sure you want to delete Room ${selected.room_number}?`)) onDeleteRoom(selected.id) }} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
