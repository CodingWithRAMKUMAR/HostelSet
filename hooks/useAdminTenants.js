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
    const reason = window.prompt(
      'Vacate and archive this tenant?\n\nThe tenant leaves active views, their room slot is released once, and payment/rent/request history is preserved. Their Auth account is not deleted.\n\nReason:'
    );
    if (reason === null) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Please log in again.');
      const response = await fetch('/api/admin/delete-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ tenantId, reason: reason.trim() || 'Admin vacated and archived tenant' }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Failed to archive tenant');
      toast.success('Tenant vacated and archived.');
      await loadTenants(true);
    } catch (error) {
      const rawMessage = String(error?.message || '');
      const safeMessage = /constraint|tenants_status_check|violates/i.test(rawMessage)
        ? 'Tenant archive is not available until the latest database lifecycle migration is applied.'
        : rawMessage || 'Please try again.';
      toast.error('Failed to archive tenant: ' + safeMessage);
    }
  };

  useEffect(() => { if (enabled) loadTenants(); }, [enabled]);
  useRealtimeRefresh('admin-tenants-live', ['tenants', 'rooms', 'properties'], loadTenants, enabled);
  return { tenants, loading, error, deleteTenant, refreshTenants: loadTenants };
}
