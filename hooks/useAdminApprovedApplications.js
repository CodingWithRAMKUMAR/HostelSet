import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useAdminApprovedApplications(enabled = true) {
  const [approvedApps, setApprovedApps] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadApprovedApplications = async (background = false) => {
    if (!background) setLoading(true);
    const { data, error } = await supabase
      .from('applications')
      .select('*, rooms(room_number, property_id)')
      .in('status', ['approved', 'rejected'])
      .order('processed_at', { ascending: false });
    if (error) toast.error('Failed to load approved applications');
    else setApprovedApps(data || []);
    setLoading(false);
  };

  useEffect(() => { if (enabled) loadApprovedApplications(); }, [enabled]);
  useRealtimeRefresh('admin-approved-applications-live', ['applications', 'rooms'], loadApprovedApplications, enabled);
  return { approvedApps, loading, refreshApprovedApplications: loadApprovedApplications };
}
