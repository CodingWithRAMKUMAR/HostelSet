import { formatDate } from '../../lib/utils';

export default function NoticesSection({ notices = [] }) {
  if (!notices || notices.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-3">📢</div>
        <p className="font-semibold text-slate-700">No notices yet</p><p className="mt-1 text-sm text-slate-500">Property and HostelSet announcements will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notices.map(notice => (
        <div key={notice.id} className={`bg-white rounded-xl border p-5 ${notice.is_urgent ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-lg">{notice.title}</h3>
            {notice.is_urgent && <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs animate-pulse">URGENT</span>}
            <span className="px-2 py-1 bg-gray-100 rounded-full text-xs">{notice.type}</span>
          </div>
          <p className="text-gray-600 mb-3">{notice.content}</p>
          <p className="text-xs text-gray-400">Posted: {formatDate(notice.created_at)}</p>
        </div>
      ))}
    </div>
  );
}
