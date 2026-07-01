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
        if (payload.eventType === 'INSERT' && (!payload.new?.property_id || payload.new.property_id === tenant.property_id)) {
          toast.success(payload.new?.property_id ? '📢 New notice posted by owner!' : '📢 New HostelSet announcement!');
        }
        loadNotices();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant?.property_id]);
  return { notices };
}
