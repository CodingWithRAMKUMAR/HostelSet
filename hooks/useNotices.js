import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useNotices(tenant) {
  const [notices, setNotices] = useState([]);
  const loadNotices = async () => {
    if (!tenant?.property_id) return;
    const { data, error } = await supabase.from('notices').select('*').or(`property_id.eq.${tenant.property_id},property_id.is.null`).order('created_at', { ascending: false }).limit(10);
    if (error) { console.error('Tenant notices load failed:', error.message); return; }
    setNotices(data || []);
  };
  useEffect(() => {
    if (!tenant?.property_id) return;
    loadNotices();
    const channel = supabase.channel('notices-tenant-isolated')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, (payload) => {
        const changedNotice = payload.new || payload.old;
        if (changedNotice?.property_id && changedNotice.property_id !== tenant.property_id) return;
        if (payload.eventType === 'INSERT' && (!payload.new?.property_id || payload.new.property_id === tenant.property_id)) {
          toast.success(payload.new?.property_id ? '📢 New notice posted by owner!' : '📢 New HostelSet announcement!');
        }
        setNotices(current => {
          if (payload.eventType === 'DELETE') return current.filter(notice => notice.id !== changedNotice?.id);
          if (!payload.new) return current;
          const index = current.findIndex(notice => notice.id === payload.new.id);
          if (index === -1) return [payload.new, ...current].slice(0, 10);
          return current.map(notice => notice.id === payload.new.id ? { ...notice, ...payload.new } : notice);
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant?.property_id]);
  return { notices };
}
