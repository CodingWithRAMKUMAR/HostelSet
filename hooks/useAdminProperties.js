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

  const deleteProperty = async (propertyId) => {
    if (!confirm('Permanently delete this property and all its data? This cannot be undone.')) return;
    const { error } = await supabase.from('properties').delete().eq('id', propertyId);
    if (error) toast.error('Failed to delete property: ' + error.message);
    else { toast.success('Property deleted successfully.'); setProperties(prev => prev.filter(p => p.id !== propertyId)); }
  };

  useEffect(() => { if (enabled) loadProperties(); }, [enabled]);
  useRealtimeRefresh('admin-properties-live', ['properties', 'users'], loadProperties, enabled);
  return { properties, loading, deleteProperty, refreshProperties: loadProperties };
}
