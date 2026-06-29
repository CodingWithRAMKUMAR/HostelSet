import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useNotices(tenant) {
  const [notices, setNotices] = useState([]);
  const loadNotices = async () => {
    if (!tenant?.property_id) return;
    const { data } = await supabase.from('notices').select('*').eq('property_id', tenant.property_id).order('created_at', { ascending: false }).limit(10);
    setNotices(data || []);
  };
  useEffect(() => {
    if (!tenant?.property_id) return;
    loadNotices();
    const channel = supabase.channel('notices-tenant-isolated')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new?.property_id === tenant.property_id) {
          toast.success('📢 New notice posted by owner!');
        }
        loadNotices();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant?.property_id]);
  return { notices };
}
