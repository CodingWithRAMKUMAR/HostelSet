const CHANNEL_REGISTRY = new WeakMap()

const debugEnabled = () => {
  if (typeof window === 'undefined') return false
  return window.localStorage?.getItem('hostelsetRealtimeDebug') === '1'
}

const sanitize = value => String(value || '')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
  .replace(/\b\d{10,}\b/g, '[number]')

export const logRealtime = (label, detail = '') => {
  if (!debugEnabled()) return
  console.info(`[HostelSetRealtime] ${label}${detail ? ` ${sanitize(detail)}` : ''}`)
}

const registryFor = client => {
  let registry = CHANNEL_REGISTRY.get(client)
  if (!registry) {
    registry = new Map()
    CHANNEL_REGISTRY.set(client, registry)
  }
  return registry
}

export const createRealtimeChannel = (client, channelName, reason = 'create') => {
  const registry = registryFor(client)
  const existing = registry.get(channelName)
  if (existing) {
    logRealtime('duplicate-channel-prevented', `channel=${channelName}`)
    client.removeChannel(existing).catch?.(() => {})
    registry.delete(channelName)
  }
  const channel = client.channel(channelName)
  registry.set(channelName, channel)
  logRealtime('channel-created', `channel=${channelName} reason=${reason}`)
  return channel
}

export const subscribeRealtimeChannel = (channel, channelName, onConnected) => {
  return channel.subscribe(status => {
    logRealtime('subscribe-status', `channel=${channelName} status=${status}`)
    onConnected?.(status === 'SUBSCRIBED', status)
  })
}

export const cleanupRealtimeChannel = (client, channel, channelName, reason = 'cleanup') => {
  if (!channel) return
  const registry = registryFor(client)
  if (registry.get(channelName) === channel) registry.delete(channelName)
  logRealtime('cleanup', `channel=${channelName} reason=${reason}`)
  client.removeChannel(channel).catch?.(() => {})
}

export const logRealtimeEvent = (payload, outcome = '') => {
  const row = payload?.new || payload?.old || {}
  logRealtime('event', `table=${payload?.table || 'unknown'} type=${payload?.eventType || 'unknown'} id=${row.id || 'unknown'}${outcome ? ` ${outcome}` : ''}`)
}

export const syncRealtimeAuth = async (client, session = null) => {
  if (!client?.realtime?.setAuth) return
  try {
    if (session?.access_token) {
      await client.realtime.setAuth(session.access_token)
      logRealtime('auth-sync', 'state=authenticated')
      return
    }
    await client.realtime.setAuth()
    logRealtime('auth-sync', 'state=anonymous')
  } catch (error) {
    logRealtime('auth-sync-failed', `message=${error?.message || 'unknown'}`)
  }
}
