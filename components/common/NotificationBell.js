import { useEffect, useState } from 'react'
import { useNotificationContext } from '../../context/NotificationContext'
import NotificationDrawer from './NotificationDrawer'
export default function NotificationBell({ listenForGlobalOpen = false }) {
  const [open,setOpen]=useState(false)
  const { unreadCount }=useNotificationContext()

  useEffect(() => {
    if (!listenForGlobalOpen) return undefined
    const openDrawer = () => setOpen(true)
    window.addEventListener('hostelset:open-notifications', openDrawer)
    return () => window.removeEventListener('hostelset:open-notifications', openDrawer)
  }, [listenForGlobalOpen])

  return <><button type="button" onClick={() => setOpen(true)} className="dashboard-icon-button notification-bell relative" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-haspopup="dialog" title="Notifications"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>{unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-orange-500 px-1 py-0.5 text-[10px] font-bold leading-4 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}</button><NotificationDrawer open={open} onClose={() => setOpen(false)}/></>
}
