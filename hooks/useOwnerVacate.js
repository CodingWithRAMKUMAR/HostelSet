import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useOwnerVacate(property, enabled = true) {
  const [vacateRequests, setVacateRequests] = useState([]);

  const loadVacateRequests = async () => {
    if (!property?.id) return;
    const { data } = await supabase.from('check_out_requests').select('*').eq('property_id', property.id).in('status', ['pending', 'approved']).order('created_at', { ascending: false });
    setVacateRequests(data || []);
  };

  const approveVacateRequest = async (requestId, tenantId, expectedDate) => {
    if (!confirm('Approve vacate request?')) return;
    const { error } = await supabase.rpc('approve_vacate_request', { p_request_id:requestId, p_tenant_id:tenantId, p_expected_check_out:expectedDate });
    if (error) { toast.error('Failed to approve'); return false; }
    toast.success('Vacate request approved');
    return true;
  };

  useEffect(() => {
    if (property?.id && enabled) loadVacateRequests();
  }, [property?.id, enabled]);
  useRealtimeRefresh(`owner-vacates-live:${property?.id || 'waiting'}`, ['check_out_requests', 'tenants', 'rooms'], loadVacateRequests, Boolean(property?.id && enabled));

  return { vacateRequests, approveVacateRequest, loadVacateRequests };
}
