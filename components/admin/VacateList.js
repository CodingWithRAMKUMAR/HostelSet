import { formatDate } from '../../lib/utils'

export default function VacateList({ vacateRequests, getDaysUntilVacate }) {
  if (!vacateRequests.length) return <p className="text-center text-gray-500">No vacate requests</p>
  return (
    <div className="space-y-4">
      {vacateRequests.map(v => {
        const daysLeft = getDaysUntilVacate(v.expected_check_out)
        return (
          <div key={v.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{v.tenants?.name || v.tenant_name}</p>
                <p className="text-sm text-gray-400">Room {v.rooms?.room_number || v.room_number}</p>
                <p className="text-sm">Expected: {formatDate(v.expected_check_out)}</p>
                <p className={`text-xs font-bold ${daysLeft > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {daysLeft > 0 ? `🚪 Vacates in ${daysLeft} days` : `⚠️ Overdue by ${Math.abs(daysLeft)} days`}
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs ${v.status === 'approved' ? 'bg-green-800 text-green-200' : v.status === 'pending' ? 'bg-yellow-800 text-yellow-200' : 'bg-gray-700'}`}>{v.status}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
