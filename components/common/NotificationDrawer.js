import { useRouter } from 'next/router'
import { useNotificationContext } from '../../context/NotificationContext'
import { formatDate } from '../../lib/utils'

export default function NotificationDrawer({ open, onClose }) {
  const router = useRouter()
  const {
    notifications,
    loading,
    hasMore,
    loadMore,
    markRead,
    markAllRead,
    browserPermission,
    requestBrowserPermission,
  } = useNotificationContext()

  if (!open) return null

  const openNotification = async (notification) => {
    if (!notification.is_read) await markRead(notification.id)
    if (notification.action_url) router.push(notification.action_url)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Notifications">
      <button className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close notifications" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">Notifications</h2>
            <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">x</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={markAllRead} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">Mark all read</button>
            {browserPermission !== 'granted' && browserPermission !== 'unsupported' && (
              <button onClick={requestBrowserPermission} className="rounded-full border border-orange-200 px-3 py-1.5 text-xs font-semibold text-orange-700">Enable Notifications</button>
            )}
          </div>
        </div>
        <div className="divide-y">
          {loading && <p className="p-4 text-sm text-slate-500">Loading notifications...</p>}
          {!loading && notifications.length === 0 && <p className="p-4 text-sm text-slate-500">No notifications yet.</p>}
          {notifications.map(notification => (
            <button
              key={notification.id}
              onClick={() => openNotification(notification)}
              className={`block w-full p-4 text-left hover:bg-orange-50 focus:bg-orange-50 focus:outline-none ${notification.is_read ? 'bg-white' : 'bg-orange-50/60'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-slate-900">{notification.title}</p>
                {!notification.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />}
              </div>
              <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
              <p className="mt-2 text-xs text-slate-400">{formatDate(notification.created_at)}</p>
            </button>
          ))}
        </div>
        {hasMore && (
          <div className="p-4">
            <button onClick={loadMore} className="w-full rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Load more</button>
          </div>
        )}
      </aside>
    </div>
  )
}
