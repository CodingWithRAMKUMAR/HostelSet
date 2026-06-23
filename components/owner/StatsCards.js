import { formatCurrency } from '../../lib/utils';

export default function StatsCards({ stats }) {
  const items = [
    { label: 'Total Rooms', value: stats?.totalRooms || 0, icon: '🏢', color: 'bg-blue-100 text-blue-600' },
    { label: 'Occupied', value: stats?.occupied || 0, icon: '🟢', color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Available', value: stats?.vacant || 0, icon: '🟡', color: 'bg-amber-100 text-amber-600' },
    { label: 'Collected', value: formatCurrency(stats?.totalCollected || 0), icon: '💰', color: 'bg-orange-100 text-orange-600' },
    { label: 'This Month', value: formatCurrency(stats?.monthlyIncome || 0), icon: '📈', color: 'bg-green-100 text-green-600' },
    { label: 'Notice Period', value: stats?.noticePeriodCount || 0, icon: '📅', color: 'bg-purple-100 text-purple-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {items.map((item, index) => (
        <div 
          key={index} 
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition duration-200 flex items-center gap-4"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-sm ${item.color}`}>
            {item.icon}
          </div>
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">{item.label}</p>
            <p className="text-xl font-bold text-gray-800 tracking-tight">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}