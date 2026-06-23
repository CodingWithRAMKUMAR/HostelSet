import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useOwnerVacate(property) {
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
    if (!property?.id) return;
    loadVacateRequests();
    const channel = supabase.channel('owner-vacate')
      .on('postgres_changes', { event:'*', schema:'public', table:'check_out_requests' }, (payload) => {
        if (payload.new?.property_id === property.id) {
          if (payload.eventType === 'INSERT') setVacateRequests(prev => [payload.new, ...prev]);
          else if (payload.eventType === 'UPDATE') setVacateRequests(prev => prev.map(v => v.id === payload.new.id ? payload.new : v));
          else if (payload.eventType === 'DELETE') setVacateRequests(prev => prev.filter(v => v.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [property?.id]);

  return { vacateRequests, approveVacateRequest, loadVacateRequests };
}
