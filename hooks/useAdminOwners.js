import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useAdminOwners(enabled = true) {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOwners = async (background = false) => {
    if (!background) setLoading(true);
    const { data, error } = await supabase.from('users').select('*').eq('role', 'owner').order('created_at', { ascending: false });
    if (error) toast.error('Failed to load owners');
    else setOwners(data || []);
    setLoading(false);
  };

  const toggleOwnerStatus = async (ownerId, currentStatus) => {
    const newStatus = !currentStatus;
    const { error } = await supabase.from('users').update({ is_active: newStatus }).eq('id', ownerId);
    if (error) toast.error('Failed to update owner status');
    else {
      toast.success(`Owner ${newStatus ? 'Activated' : 'Suspended'}`);
      setOwners(prev => prev.map(o => o.id === ownerId ? { ...o, is_active: newStatus } : o));
    }
  };

  useEffect(() => { if (enabled) loadOwners(); }, [enabled]);
  useRealtimeRefresh('admin-owners-live', ['users'], loadOwners, enabled);
  return { owners, loading, toggleOwnerStatus, refreshOwners: loadOwners };
}
