import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useAdminProperties(enabled = true) {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadProperties = async (background = false) => {
    if (!background) setLoading(true);
    const { data, error } = await supabase.from('properties').select('*, users:owner_id(full_name, email, phone)').order('created_at', { ascending: false });
    if (error) toast.error('Failed to load properties');
    else setProperties(data || []);
    setLoading(false);
  };

  const archiveProperty = async (propertyId) => {
    const reason = window.prompt(
      'Archive this property?\n\nIt will disappear from Browse Hostels and stop new public applications. Rooms, tenants, payments, requests, and history remain preserved.\n\nReason:'
    );
    if (reason === null) return;
    const { error } = await supabase.rpc('archive_property', { p_property_id: propertyId, p_reason: reason.trim() || 'Admin archived property' });
    if (error) toast.error('Failed to archive property: ' + error.message);
    else { toast.success('Property archived. Historical records were preserved.'); await loadProperties(true); }
  };

  const restoreProperty = async (propertyId) => {
    const reason = window.prompt('Restore this property to active status? It will only appear publicly if it has active tenants.\n\nReason:');
    if (reason === null) return;
    const { error } = await supabase.rpc('restore_property', { p_property_id: propertyId, p_reason: reason.trim() || 'Admin restored property' });
    if (error) toast.error('Failed to restore property: ' + error.message);
    else { toast.success('Property restored. Public visibility still depends on active tenants.'); await loadProperties(true); }
  };

  useEffect(() => { if (enabled) loadProperties(); }, [enabled]);
  useRealtimeRefresh('admin-properties-live', ['properties', 'users'], loadProperties, enabled);
  return { properties, loading, archiveProperty, restoreProperty, deleteProperty: archiveProperty, refreshProperties: loadProperties };
}
