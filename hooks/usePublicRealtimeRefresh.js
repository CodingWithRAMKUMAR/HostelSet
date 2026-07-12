import { useEffect, useRef, useState } from 'react'
import { publicSupabase } from '../lib/publicSupabase'

export function usePublicRealtimeRefresh(channelName, tables, onChange, enabled = true, delay = 250) {
  const callbackRef = useRef(onChange)
  const [connected, setConnected] = useState(false)
  useEffect(() => { callbackRef.current = onChange }, [onChange])
  useEffect(() => {
    if (!enabled || !tables.length) return undefined
    let timer; let active = true
    setConnected(false)
    let channel = publicSupabase.channel(channelName)
    const scheduleRefresh = () => { clearTimeout(timer); timer = setTimeout(() => callbackRef.current?.(true), delay) }
    tables.forEach(table => { channel = channel.on('postgres_changes', { event:'*', schema:'public', table }, scheduleRefresh) })
    channel.subscribe(status => { if (active) setConnected(status === 'SUBSCRIBED') })
    return () => { active = false; clearTimeout(timer); publicSupabase.removeChannel(channel) }
  }, [channelName, enabled, delay, tables.join(',')])
  return connected
}
