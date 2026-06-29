import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeRefresh(channelName, tables, onChange, enabled = true, delay = 250) {
  const callbackRef = useRef(onChange);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    callbackRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled || !tables.length) return undefined;

    let timer;
    let channel = supabase.channel(channelName);
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => callbackRef.current?.(true), delay);
    };

    tables.forEach((table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh);
    });
    channel.subscribe((status) => setConnected(status === 'SUBSCRIBED'));

    return () => {
      clearTimeout(timer);
      setConnected(false);
      supabase.removeChannel(channel);
    };
  }, [channelName, enabled, delay, tables.join(',')]);

  return connected;
}
