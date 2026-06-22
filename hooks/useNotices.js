import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useNotices(tenant) {
  const [notices, setNotices] = useState([]);

  const loadNotices = async () => {
    if (!tenant?.property_id) return;
    const { data } = await supabase
      .from('notices')
      .select('*')
      .eq('property_id', tenant.property_id)
      .order('created_at', { ascending: false })
      .limit(10);
    setNotices(data || []);
  };

  // Real-time subscription (Isolated Fix)
  useEffect(() => {
    if (!tenant?.property_id) return;
    
    loadNotices();

    const channel = supabase
      .channel('notices-tenant-isolated')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' }, (payload) => {
        if (payload.new?.property_id === tenant.property_id) {
          setNotices(prev => [payload.new, ...prev]);
          toast.success('📢 New notice posted by owner!');
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notices' }, (payload) => {
        // CRITICAL FIX: Removed property_id check. It deletes instantly now.
        if (payload.old) {
          setNotices(prev => prev.filter(n => n.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenant?.property_id]);

  return { notices };
}
