import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 30

export function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [browserPermission, setBrowserPermission] = useState(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    return Notification.permission
  })
  const seenIds = useRef(new Set())
  const currentUserId = useRef(null)
  const notificationCount = useRef(0)

  const unreadCount = useMemo(() => notifications.filter(item => !item.is_read).length, [notifications])

  const loadNotifications = useCallback(async ({ append = false } = {}) => {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    currentUserId.current = userId || null
    if (!userId) {
      setNotifications([])
      setHasMore(false)
      setLoading(false)
      return
    }

    const from = append ? notificationCount.current : 0
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (!error) {
      const rows = data || []
      rows.forEach(row => seenIds.current.add(row.id))
      setNotifications(current => {
        const next = append ? [...current, ...rows] : rows
        notificationCount.current = next.length
        return next
      })
      setHasMore(rows.length === PAGE_SIZE)
    }
    setLoading(false)
  }, [])

  const markRead = useCallback(async (id) => {
    setNotifications(current => current.map(item => item.id === id ? { ...item, is_read: true, read_at: item.read_at || new Date().toISOString() } : item))
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id)
  }, [])

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    setNotifications(current => current.map(item => ({ ...item, is_read: true, read_at: item.read_at || now })))
    await supabase.from('notifications').update({ is_read: true, read_at: now }).eq('is_read', false)
  }, [])

  const requestBrowserPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserPermission('unsupported')
      return 'unsupported'
    }
    const permission = await Notification.requestPermission()
    setBrowserPermission(permission)
    return permission
  }, [])

  const showBrowserNotification = useCallback((notification) => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return
    const browserNotification = new Notification(notification.title, {
      body: notification.message,
      tag: notification.id,
      data: { actionUrl: notification.action_url },
    })
    browserNotification.onclick = () => {
      window.focus()
      if (notification.action_url) window.location.href = notification.action_url
    }
  }, [])

  useEffect(() => {
    let active = true
    let channel
    let poller

    const start = async () => {
      await loadNotifications()
      if (!active || !currentUserId.current) return

      channel = supabase
        .channel(`notifications:${currentUserId.current}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${currentUserId.current}`,
        }, payload => {
          const notification = payload.new
          if (!notification || seenIds.current.has(notification.id)) return
          seenIds.current.add(notification.id)
          setNotifications(current => {
            const next = [notification, ...current].slice(0, PAGE_SIZE)
            notificationCount.current = next.length
            return next
          })
          showBrowserNotification(notification)
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${currentUserId.current}`,
        }, payload => {
          setNotifications(current => current.map(item => item.id === payload.new.id ? payload.new : item))
        })
        .subscribe(status => {
          if (active) setRealtimeConnected(status === 'SUBSCRIBED')
        })

      poller = setInterval(() => {
        if (document.visibilityState === 'visible') loadNotifications()
      }, 60000)
    }

    start()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        setNotifications([])
        seenIds.current.clear()
      }
    })
    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
      if (poller) clearInterval(poller)
      subscription?.unsubscribe()
    }
  }, [loadNotifications, showBrowserNotification])

  return {
    notifications,
    unreadCount,
    loading,
    realtimeConnected,
    hasMore,
    loadMore: () => loadNotifications({ append: true }),
    refresh: () => loadNotifications(),
    markRead,
    markAllRead,
    browserPermission,
    requestBrowserPermission,
  }
}
