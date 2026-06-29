import { formatDate } from '../../lib/utils'

export default function AuditLogsTable({ logs }) {
  return (
    <div className="bg-gray-900 rounded-2xl shadow-xl overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-800 border-b">
          <tr><th>Time</th><th>Action</th><th>Details</th></tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} className="border-b border-gray-800">
              <td className="px-4 py-3 text-sm">{formatDate(log.created_at)}</td>
              <td className="font-mono text-sm">{log.action}</td>
              <td className="text-sm">{log.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
