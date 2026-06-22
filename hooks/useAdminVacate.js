import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useAdminVacate() {
  const [vacateRequests, setVacateRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadVacate = async () => {
    setLoading(true);
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

  useEffect(() => {
    loadVacate();
    const channel = supabase.channel('admin-vacate')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'check_out_requests' }, (payload) => {
        if (payload.eventType === 'INSERT') setVacateRequests(prev => [payload.new, ...prev]);
        else if (payload.eventType === 'UPDATE') setVacateRequests(prev => prev.map(v => v.id === payload.new.id ? payload.new : v));
        else if (payload.eventType === 'DELETE') setVacateRequests(prev => prev.filter(v => v.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
  return { vacateRequests, loading, approveVacate, rejectVacate, refreshVacate: loadVacate };
}
