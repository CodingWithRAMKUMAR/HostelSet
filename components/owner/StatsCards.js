import { formatCurrency } from '../../lib/utils';

export default function StatsCards({ stats }) {
  const items = [
    { label: 'Total Rooms', value: stats?.totalRooms || 0, icon: '🏢', color: 'bg-blue-100 text-blue-600' },
    { label: 'Occupied', value: stats?.occupied || 0, icon: '🟢', color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Available', value: stats?.vacant || 0, icon: '🟡', color: 'bg-amber-100 text-amber-600' },
    { label: 'Tenants', value: stats?.tenantCount || 0, icon: '👥', color: 'bg-indigo-100 text-indigo-600' },
    { label: 'Collected', value: formatCurrency(stats?.totalCollected || 0), icon: '💰', color: 'bg-orange-100 text-orange-600' },
    { label: 'Pending Rent', value: formatCurrency(stats?.pendingAmount || 0), icon: '🧾', color: 'bg-red-100 text-red-600' },
    { label: 'This Month', value: formatCurrency(stats?.monthlyIncome || 0), icon: '📈', color: 'bg-green-100 text-green-600' },
    { label: 'Pending Payments', value: stats?.pendingRentConfirmations || 0, icon: '⏳', color: 'bg-purple-100 text-purple-600' },
    { label: 'Active Notices', value: stats?.activeNotices || 0, icon: '📢', color: 'bg-cyan-100 text-cyan-600' },
    { label: 'Applications', value: stats?.pendingApplications || 0, icon: '📝', color: 'bg-fuchsia-100 text-fuchsia-600' },
    { label: 'Existing Imports', value: stats?.pendingImports || 0, icon: '📥', color: 'bg-teal-100 text-teal-700' },
    { label: 'Complaints', value: stats?.totalComplaints || 0, icon: '🔧', color: 'bg-rose-100 text-rose-600' },
    { label: 'Vacate Requests', value: stats?.pendingVacate || 0, icon: '🚪', color: 'bg-yellow-100 text-yellow-700' },
    { label: 'Room Changes', value: stats?.pendingRoomChanges || 0, icon: '🔄', color: 'bg-sky-100 text-sky-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
      {items.map((item, index) => (
        <div 
          key={index} 
          className="bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition duration-200 flex items-center gap-2 sm:gap-4 min-w-0"
        >
          <div className={`w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-full flex items-center justify-center text-base sm:text-xl shadow-sm ${item.color}`}>
            {item.icon}
          </div>
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">{item.label}</p>
            <p className="text-base sm:text-xl font-bold text-gray-800 tracking-tight truncate">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
