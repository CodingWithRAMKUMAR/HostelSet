export default function PostNoticeModal({ noticeForm, setNoticeForm, onPost, onCancel, isSubmitting }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">Post Notice</h2>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Title *"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl"
            value={noticeForm.title}
            onChange={(e) => setNoticeForm({...noticeForm, title: e.target.value})}
          />
          <textarea
            placeholder="Content *"
            rows="4"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl"
            value={noticeForm.content}
            onChange={(e) => setNoticeForm({...noticeForm, content: e.target.value})}
          />
          <select
            className="w-full px-4 py-3 border border-gray-200 rounded-xl"
            value={noticeForm.type}
            onChange={(e) => setNoticeForm({...noticeForm, type: e.target.value})}
          >
            <option value="general">General</option>
            <option value="maintenance">Maintenance</option>
            <option value="payment">Payment</option>
            <option value="event">Event</option>
            <option value="emergency">Emergency</option>
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={noticeForm.is_urgent}
              onChange={(e) => setNoticeForm({...noticeForm, is_urgent: e.target.checked})}
              className="w-4 h-4"
            />
            <span className="text-sm">Mark as Urgent</span>
          </label>
          <div className="flex gap-3 mt-6">
            <button onClick={onPost} disabled={isSubmitting} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
              {isSubmitting ? 'Posting...' : 'Post Notice'}
            </button>
            <button onClick={onCancel} disabled={isSubmitting} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold disabled:opacity-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
