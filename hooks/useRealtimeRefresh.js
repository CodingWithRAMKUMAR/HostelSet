import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { cleanupRealtimeChannel, createRealtimeChannel, logRealtime, logRealtimeEvent, subscribeRealtimeChannel } from '../lib/realtime';

export function useRealtimeRefresh(channelName, tables, onChange, enabled = true, delay = 250) {
  const callbackRef = useRef(onChange);
  const connectedRef = useRef(false);
  const refreshRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [reconnectTick, setReconnectTick] = useState(0);

  useEffect(() => {
    callbackRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  useEffect(() => {
    if (!enabled) return undefined;
    const recover = () => {
      if (connectedRef.current) return;
      logRealtime('reconnect-attempt', `channel=${channelName}`);
      setReconnectTick(value => value + 1);
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') recover(); };
    window.addEventListener('online', recover);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', recover);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [channelName, enabled]);

  useEffect(() => {
    if (!enabled || !tables.length) return undefined;

    let timer;
    let active = true;
    setConnected(false);
    let channel = createRealtimeChannel(supabase, channelName);
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        refreshRef.current += 1;
        callbackRef.current?.({ background: true, force: true, reason: `realtime:${channelName}:${refreshRef.current}` });
      }, delay);
    };

    tables.forEach((table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        logRealtimeEvent(payload, 'refresh=resource-specific');
        scheduleRefresh();
      });
    });
    subscribeRealtimeChannel(channel, channelName, (isConnected, status) => {
      if (!active) return;
      setConnected(isConnected);
      if (['TIMED_OUT', 'CHANNEL_ERROR', 'CLOSED'].includes(status)) {
        window.setTimeout(() => { if (active) setReconnectTick(value => value + 1); }, 1000);
      }
    });

    return () => {
      active = false;
      clearTimeout(timer);
      cleanupRealtimeChannel(supabase, channel, channelName, 'effect-cleanup');
    };
  }, [channelName, enabled, delay, tables.join(','), reconnectTick]);

  return connected;
}
