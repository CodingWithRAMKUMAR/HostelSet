import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useAdminTenants(enabled = true) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTenants = async (background = false) => {
    if (!background) setLoading(true);
    const { data, error } = await supabase.from('tenants').select('*, rooms(room_number), property:property_id(name)').order('created_at', { ascending: false });
    if (error) {
      console.error('Admin tenant query failed:', error);
      setError(error.message);
      toast.error('Failed to load tenants: ' + error.message);
    } else {
      setError(null);
      setTenants(data || []);
    }
    setLoading(false);
  };

  const deleteTenant = async (tenantId, userId) => {
    if (!confirm('Permanently delete this tenant? This will remove their user account.')) return;
    const { error } = await supabase.from('tenants').delete().eq('id', tenantId);
    if (error) toast.error('Failed to delete tenant: ' + error.message);
    else {
      if (userId) await supabase.from('users').delete().eq('id', userId);
      toast.success('Tenant deleted permanently.');
      setTenants(prev => prev.filter(t => t.id !== tenantId));
    }
  };

  useEffect(() => { if (enabled) loadTenants(); }, [enabled]);
  useRealtimeRefresh('admin-tenants-live', ['tenants', 'rooms', 'properties'], loadTenants, enabled);
  return { tenants, loading, error, deleteTenant, refreshTenants: loadTenants };
}
