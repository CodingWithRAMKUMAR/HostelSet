import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useAdminVacate(enabled = true) {
  const [vacateRequests, setVacateRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadVacate = async (background = false) => {
    if (!background) setLoading(true);
    const { data, error } = await supabase.from('check_out_requests').select('*, tenants(name, phone, room_id, rooms(room_number))').order('created_at', { ascending: false });
    if (error) toast.error('Failed to load vacate requests');
    else setVacateRequests(data || []);
    setLoading(false);
  };

  const approveVacate = async (requestId, tenantId, expectedDate) => {
    const { error } = await supabase.rpc('approve_vacate_request', { p_request_id: requestId, p_tenant_id: tenantId, p_expected_check_out: expectedDate });
    if (error) toast.error('Failed to approve vacate');
    else { toast.success('Vacate request approved.'); await loadVacate(); }
  };

  const rejectVacate = async (requestId) => {
    if (!confirm('Reject this vacate request?')) return;
    const { error } = await supabase.from('check_out_requests').update({ status: 'rejected', processed_at: new Date().toISOString() }).eq('id', requestId);
    if (error) toast.error('Failed to reject vacate');
    else { toast.success('Vacate request rejected.'); await loadVacate(); }
  };

  useEffect(() => { if (enabled) loadVacate(); }, [enabled]);
  useRealtimeRefresh('admin-vacate-live', ['check_out_requests', 'tenants', 'rooms'], loadVacate, enabled);
  return { vacateRequests, loading, approveVacate, rejectVacate, refreshVacate: loadVacate };
}
