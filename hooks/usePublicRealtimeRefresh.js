import { useEffect, useRef, useState } from 'react'
import { publicSupabase } from '../lib/publicSupabase'
import { cleanupRealtimeChannel, createRealtimeChannel, logRealtime, logRealtimeEvent, subscribeRealtimeChannel } from '../lib/realtime'

export function usePublicRealtimeRefresh(channelName, tables, onChange, enabled = true, delay = 250) {
  const callbackRef = useRef(onChange)
  const connectedRef = useRef(false)
  const [connected, setConnected] = useState(false)
  const [reconnectTick, setReconnectTick] = useState(0)
  useEffect(() => { callbackRef.current = onChange }, [onChange])
  useEffect(() => { connectedRef.current = connected }, [connected])
  useEffect(() => {
    if (!enabled) return undefined
    const recover = () => {
      if (connectedRef.current) return
      logRealtime('reconnect-attempt', `channel=${channelName}`)
      setReconnectTick(value => value + 1)
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') recover() }
    window.addEventListener('online', recover)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('online', recover)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [channelName, enabled])
  useEffect(() => {
    if (!enabled || !tables.length) return undefined
    let timer; let active = true
    setConnected(false)
    let channel = createRealtimeChannel(publicSupabase, channelName)
    const scheduleRefresh = () => { clearTimeout(timer); timer = setTimeout(() => callbackRef.current?.({ background: true, reason: `public-realtime:${channelName}` }), delay) }
    tables.forEach(table => {
      channel = channel.on('postgres_changes', { event:'*', schema:'public', table }, payload => {
        logRealtimeEvent(payload, 'refresh=public-safe')
        scheduleRefresh()
      })
    })
    subscribeRealtimeChannel(channel, channelName, (isConnected, status) => {
      if (!active) return
      setConnected(isConnected)
      if (['TIMED_OUT', 'CHANNEL_ERROR', 'CLOSED'].includes(status)) {
        window.setTimeout(() => { if (active) setReconnectTick(value => value + 1) }, 1000)
      }
    })
    return () => { active = false; clearTimeout(timer); cleanupRealtimeChannel(publicSupabase, channel, channelName, 'effect-cleanup') }
  }, [channelName, enabled, delay, tables.join(','), reconnectTick])
  return connected
}
