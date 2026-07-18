import { formatDate } from '../../lib/utils';

export default function NoticeList({ notices = [], onDelete = () => {}, onPost = () => {}, isSubmitting = false }) {
  return (
    <div className="space-y-4">
      <button 
        onClick={onPost} 
        disabled={isSubmitting} 
        className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold mb-4 hover:bg-slate-700 transition disabled:opacity-50"
      >
        + Post New Notice
      </button>

      {!notices || notices.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="text-5xl mb-3">📢</div>
          <p className="text-gray-500">No notices posted yet</p>
        </div>
      ) : (
        notices.map(notice => (
          <article key={notice.id} className={`relative overflow-hidden rounded-xl border bg-white ${notice.is_urgent ? 'border-red-200 bg-red-50' : 'border-gray-100'} group`}>
            {notice.image_url && (
              <img
                src={notice.image_url}
                alt={notice.title ? `${notice.title} notice` : 'Notice image'}
                loading="lazy"
                className="max-h-56 w-full bg-slate-100 object-contain sm:max-h-80"
              />
            )}
            <div className="p-4">
              {notice.property_id && (
                <button
                  onClick={() => onDelete(notice.id)}
                  disabled={isSubmitting}
                  className="absolute right-4 top-4 rounded-lg bg-white/90 px-2 py-1 text-red-500 shadow-sm transition hover:text-red-700 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  🗑️ Delete
                </button>
              )}
              <div className="mb-2 flex flex-wrap items-center gap-2 pr-12">
                <h3 className="font-semibold text-slate-800">{notice.title}</h3>
                {notice.is_urgent && <span className="rounded-full bg-red-500 px-2 py-1 text-xs text-white">URGENT</span>}
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs capitalize text-gray-600">{notice.type}</span>
                {!notice.property_id && <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700">HostelSet</span>}
              </div>
              <p className="whitespace-pre-wrap text-gray-600">{notice.content}</p>
              <p className="mt-2 text-xs text-gray-400">Posted: {formatDate(notice.created_at)}</p>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
