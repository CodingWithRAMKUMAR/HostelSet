import { formatCurrency } from '../../lib/utils'

export default function AdminStatsCards({ stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-gradient-to-br from-purple-800 to-indigo-800 rounded-xl p-5 shadow-lg">
        <p className="text-white/80 text-sm">Properties</p>
        <p className="text-3xl font-bold">{stats.totalProperties}</p>
      </div>
      <div className="bg-gradient-to-br from-pink-800 to-rose-800 rounded-xl p-5 shadow-lg">
        <p className="text-white/80 text-sm">Tenants</p>
        <p className="text-3xl font-bold">{stats.totalTenants}</p>
      </div>
      <div className="bg-gradient-to-br from-emerald-800 to-green-800 rounded-xl p-5 shadow-lg">
        <p className="text-white/80 text-sm">Revenue (₹)</p>
        <p className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
      </div>
      <div className="bg-gradient-to-br from-blue-800 to-cyan-800 rounded-xl p-5 shadow-lg">
        <p className="text-white/80 text-sm">Occupancy</p>
        <p className="text-3xl font-bold">{stats.occupancyRate}%</p>
      </div>
    </div>
  )
}
