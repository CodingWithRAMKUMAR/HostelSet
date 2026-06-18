import { formatDate } from '../../lib/utils'

export default function NoticesList({ notices, onPost, onDelete }) {
  return (
    <div className="space-y-4">
      <button onClick={onPost} className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded-lg mb-4">+ Post Notice</button>
      {notices.map(n => (
        <div key={n.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex justify-between items-start">
          <div>
            <p className="font-semibold">{n.title}</p>
            <p className="text-sm text-gray-400">{n.properties?.name} • {n.type}</p>
            <p className="text-sm">{n.content}</p>
            <p className="text-xs text-gray-500">{formatDate(n.created_at)}</p>
          </div>
          <button onClick={() => onDelete(n.id)} className="text-red-400 text-sm">Delete</button>
        </div>
      ))}
    </div>
  )
}
