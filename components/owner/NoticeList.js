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
          <div key={notice.id} className={`bg-white rounded-xl border p-4 ${notice.is_urgent ? 'border-red-200 bg-red-50' : 'border-gray-100'} relative group`}>
            <button 
              onClick={() => onDelete(notice.id)} 
              disabled={isSubmitting} 
              className="absolute top-4 right-4 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
            >
              🗑️ Delete
            </button>
            <div className="flex items-center gap-2 mb-2 pr-12">
              <h3 className="font-semibold text-slate-800">{notice.title}</h3>
              {notice.is_urgent && <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs">URGENT</span>}
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">{notice.type}</span>
            </div>
            <p className="text-gray-600">{notice.content}</p>
            <p className="text-xs text-gray-400 mt-2">Posted: {formatDate(notice.created_at)}</p>
          </div>
        ))
      )}
    </div>
  );
}
