import { formatDate } from '../../lib/utils'

export default function QuickAlerts({ stats, expiringMemberships }) {
  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.pendingMemberships > 0 && <div className="bg-yellow-600/20 border border-yellow-600 text-yellow-300 rounded-xl p-3">⭐ {stats.pendingMemberships} owners without membership</div>}
        {stats.pendingPayments > 0 && <div className="bg-red-600/20 border border-red-600 text-red-300 rounded-xl p-3">💰 {stats.pendingPayments} pending payments</div>}
        {stats.pendingApplications > 0 && <div className="bg-blue-600/20 border border-blue-600 text-blue-300 rounded-xl p-3">📋 {stats.pendingApplications} new applications</div>}
        {stats.unresolvedComplaints > 0 && <div className="bg-orange-600/20 border border-orange-600 text-orange-300 rounded-xl p-3">🔧 {stats.unresolvedComplaints} open complaints</div>}
        {stats.pendingRoomChanges > 0 && <div className="bg-purple-600/20 border border-purple-600 text-purple-300 rounded-xl p-3">🔄 {stats.pendingRoomChanges} room change requests</div>}
      </div>

      {expiringMemberships.length > 0 && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4">
          <h3 className="font-bold text-red-400 mb-2">⚠️ Membership Expiry Alerts</h3>
          <div className="space-y-1">
            {expiringMemberships.map(p => {
              const daysLeft = Math.ceil((new Date(p.membership_expiry) - new Date()) / (1000 * 60 * 60 * 24))
              return (
                <div key={p.id} className="text-sm">
                  • {p.name} (Owner: {p.users?.full_name}) – expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
