import { formatDate } from '../../lib/utils'

export default function ApprovedApplicationsList({ applications }) {
  return (
    <div className="bg-gray-900 rounded-2xl shadow-xl overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-800 border-b">
          <tr><th>Name</th><th>Phone</th><th>Status</th><th>Processed Date</th></tr>
        </thead>
        <tbody>
          {applications.map(app => (
            <tr key={app.id} className="border-b border-gray-800">
              <td className="px-4 py-3">{app.name}</td>
              <td>{app.phone}</td>
              <td>{app.status}</td>
              <td>{formatDate(app.processed_at || app.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
