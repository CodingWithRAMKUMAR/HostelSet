import { formatCurrency } from '../../lib/utils';
import { useRealtimeData } from '../../hooks/useRealtimeData';

export default function StatsCards() {
  // Subscribe to all relevant tables
  const { data: rooms } = useRealtimeData('rooms');
  const { data: tenants } = useRealtimeData('tenants');
  const { data: payments } = useRealtimeData('payments');
  const { data: vacateRequests } = useRealtimeData('vacate_requests');

  // Calculate stats dynamically whenever data changes
  const stats = {
    totalRooms: rooms.length,
    occupied: tenants.length,
    vacant: rooms.reduce((acc, room) => acc + (room.capacity - room.current_occupants), 0),
    totalCollected: payments
      .filter(p => p.status === 'success')
      .reduce((acc, p) => acc + Number(p.amount), 0),
    monthlyIncome: payments
      .filter(p => p.status === 'success' && new Date(p.payment_date).getMonth() === new Date().getMonth())
      .reduce((acc, p) => acc + Number(p.amount), 0),
    noticePeriodCount: vacateRequests.filter(v => v.status === 'approved').length
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
        <div className="text-2xl font-bold text-slate-800">{stats.totalRooms}</div>
        <div className="text-xs text-gray-500">Total Rooms</div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
        <div className="text-2xl font-bold text-green-600">{stats.occupied}</div>
        <div className="text-xs text-gray-500">Occupied</div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
        <div className="text-2xl font-bold text-orange-500">{stats.vacant}</div>
        <div className="text-xs text-gray-500">Available</div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
        <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalCollected)}</div>
        <div className="text-xs text-gray-500">Collected</div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
        <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.monthlyIncome)}</div>
        <div className="text-xs text-gray-500">This Month</div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
        <div className="text-2xl font-bold text-purple-600">{stats.noticePeriodCount}</div>
        <div className="text-xs text-gray-500">Notice Period</div>
      </div>
    </div>
  );
}