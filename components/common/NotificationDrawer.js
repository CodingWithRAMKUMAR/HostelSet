import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/router'
import { useNotificationContext } from '../../context/NotificationContext'
import { formatDate } from '../../lib/utils'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

export default function NotificationDrawer({ open, onClose }) {
  const router = useRouter()
  useBodyScrollLock(open)
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

  useEffect(() => {
    if (!open) return undefined
    const key = event => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
    }
  }, [open, onClose])

  if (!open) return null

  const openNotification = async notification => {
    if (!notification.is_read) await markRead(notification.id)
    if (notification.action_url) router.push(notification.action_url)
    onClose()
  }

  const drawer = (
    <div className="fixed inset-0 z-[9999] overflow-hidden" role="dialog" aria-modal="true" aria-label="Notifications">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Close notifications" />
      <aside className="fixed inset-x-2 top-2 flex max-h-[86dvh] min-h-[min(30rem,86dvh)] min-w-0 flex-col overflow-hidden rounded-[1.1rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:left-auto sm:right-3 sm:top-3 sm:max-h-[calc(100dvh_-_1.5rem_-_env(safe-area-inset-bottom))] sm:w-[min(420px,calc(100vw_-_1.5rem))]">
        <header className="shrink-0 border-b border-slate-200 p-2.5 dark:border-slate-700">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-orange-500">Inbox</p>
              <h2 className="mt-0.5 truncate text-base font-black leading-tight text-slate-900 dark:text-white">Notifications</h2>
            </div>
            <button onClick={onClose} className="dashboard-icon-button !border-slate-200 !bg-slate-100 !text-slate-600 dark:!border-slate-700 dark:!bg-slate-800 dark:!text-slate-200" aria-label="Close">
              <svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={markAllRead} className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white dark:bg-orange-500">Mark all read</button>
            {browserPermission !== 'granted' && browserPermission !== 'unsupported' && (
              <button onClick={requestBrowserPermission} className="rounded-lg border border-orange-200 px-2.5 py-1.5 text-xs font-bold text-orange-700 dark:border-orange-500/40 dark:text-orange-300">Enable alerts</button>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden p-2 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]">
          {loading && <p className="p-3 text-sm text-slate-500 dark:text-slate-400">Loading notifications…</p>}
          {!loading && notifications.length === 0 && (
            <div className="p-6 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-lg dark:bg-slate-800">✓</div>
              <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-white">You’re all caught up</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">New updates will appear here.</p>
            </div>
          )}
          {notifications.map(notification => (
            <button
              key={notification.id}
              onClick={() => openNotification(notification)}
              className={`flex w-full min-w-0 gap-2 rounded-xl border p-2 text-left shadow-sm transition ${notification.is_read ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800' : 'border-orange-200 bg-orange-50 dark:border-orange-500/40 dark:bg-orange-500/10'}`}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500 ${notification.is_read ? 'opacity-0' : 'opacity-100'}`} />
              <span className="min-w-0">
                <span className="block break-words text-xs font-bold leading-tight text-slate-900 dark:text-white">{notification.title}</span>
                <span className="mt-1 block break-words text-[11px] leading-4 text-slate-600 dark:text-slate-300">{notification.message}</span>
                <span className="mt-1.5 block text-[10px] text-slate-400">{formatDate(notification.created_at)}</span>
              </span>
            </button>
          ))}
        </div>

        {hasMore && (
          <footer className="shrink-0 border-t border-slate-200 p-2.5 pb-[calc(0.625rem_+_env(safe-area-inset-bottom))] dark:border-slate-700">
            <button onClick={loadMore} className="w-full rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Load more</button>
          </footer>
        )}
      </aside>
    </div>
  )

  return createPortal(drawer, document.body)
}
