import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useAdminTenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTenants = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('tenants').select('*, rooms(room_number), property:property_id(name)').order('created_at', { ascending: false });
    if (error) toast.error('Failed to load tenants');
    else setTenants(data || []);
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

  useEffect(() => { loadTenants(); }, []);
  return { tenants, loading, deleteTenant, refreshTenants: loadTenants };
}
