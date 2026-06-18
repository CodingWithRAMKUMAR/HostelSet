import { formatCurrency } from '../../lib/utils'

export default function StatsCards({ stats = {} }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
        <div className="text-2xl font-bold text-slate-800">{stats.totalRooms || 0}</div>
        <div className="text-xs text-gray-500">Total Rooms</div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
        <div className="text-2xl font-bold text-green-600">{stats.occupied || 0}</div>
        <div className="text-xs text-gray-500">Occupied</div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
        <div className="text-2xl font-bold text-orange-500">{stats.vacant || 0}</div>
        <div className="text-xs text-gray-500">Available</div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
        <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalCollected || 0)}</div>
        <div className="text-xs text-gray-500">Collected</div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
        <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.monthlyIncome || 0)}</div>
        <div className="text-xs text-gray-500">This Month</div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
        <div className="text-2xl font-bold text-purple-600">{stats.noticePeriodCount || 0}</div>
        <div className="text-xs text-gray-500">Notice Period</div>
      </div>
    </div>
  )
}
