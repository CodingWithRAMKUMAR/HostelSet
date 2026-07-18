import { formatDate } from '../../lib/utils'

export default function NoticesSection({ notices = [] }) {
  if (!notices || notices.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mb-3 text-5xl">📢</div>
        <p className="font-semibold text-slate-700">No notices yet</p>
        <p className="mt-1 text-sm text-slate-500">Property and HostelSet announcements will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {notices.map(notice => (
        <article key={notice.id} className={`overflow-hidden rounded-xl border bg-white ${notice.is_urgent ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
          {notice.image_url && (
            <img src={notice.image_url} alt={notice.title ? `${notice.title} notice` : 'Notice image'} loading="lazy" className="max-h-56 w-full bg-slate-100 object-contain sm:max-h-80" />
          )}
          <div className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900">{notice.title}</h3>
              {notice.is_urgent && <span className="animate-pulse rounded-full bg-red-500 px-2 py-1 text-xs text-white">URGENT</span>}
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs capitalize text-slate-600">{notice.type}</span>
              {!notice.property_id && <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700">HostelSet</span>}
            </div>
            <p className="mb-3 whitespace-pre-wrap text-gray-600">{notice.content}</p>
            <p className="text-xs text-gray-400">Posted: {formatDate(notice.created_at)}</p>
          </div>
        </article>
      ))}
    </div>
  )
}
