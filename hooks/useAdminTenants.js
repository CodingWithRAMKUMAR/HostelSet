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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Please log in again.');
      const response = await fetch('/api/admin/delete-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ tenantId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Failed to delete tenant');
      toast.success('Tenant deleted permanently.');
      await loadTenants(true);
    } catch (error) {
      toast.error('Failed to delete tenant: ' + error.message);
    }
  };

  useEffect(() => { if (enabled) loadTenants(); }, [enabled]);
  useRealtimeRefresh('admin-tenants-live', ['tenants', 'rooms', 'properties'], loadTenants, enabled);
  return { tenants, loading, error, deleteTenant, refreshTenants: loadTenants };
}
