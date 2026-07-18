import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useVacate(tenant, setTenant, initialVacateRequests = null, snapshotLoaded = false) {
  const [existingVacateRequest, setExistingVacateRequest] = useState(null);
  const [lastVacateDecision, setLastVacateDecision] = useState(null);
  const [vacateLoaded, setVacateLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const applyVacateRequests = (data) => {
    const requests = Array.isArray(data) ? data : [];
    const activeRequest = requests.find(request => ['pending', 'approved'].includes(request.status)) || null;
    setExistingVacateRequest(activeRequest);
    setLastVacateDecision(requests[0]?.status === 'rejected' ? requests[0] : null);
    setVacateLoaded(true);
    if (activeRequest?.status === 'approved') {
      setTenant(prev => ({ ...prev, status:'notice_period', check_out_requested:true, notice_period_end:activeRequest.expected_check_out }));
    }
  };

  const loadVacate = async () => {
    if (!tenant?.id) return;
    const { data, error } = await supabase.from('check_out_requests').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(10);
    if (error) { console.error('Vacate status load failed:', error); return; }
    applyVacateRequests(data);
  };

  const cancelVacateRequest = async () => {
    if (isSubmitting) return;
    if (!existingVacateRequest) { toast.error('No vacate request to cancel.'); return; }
    const { data: preBooking } = await supabase.from('pre_bookings').select('id').eq('room_id', tenant.room_id).eq('status', 'approved').maybeSingle();
    if (preBooking) { toast.error('Cannot cancel vacate – a pre‑booking has already been approved for this room.'); return; }
    if (!confirm('Cancel your vacate request?')) return;
    const prevRequest = existingVacateRequest; const prevTenant = tenant;
    setIsSubmitting(true);
    setExistingVacateRequest(null);
    setTenant(prev => ({ ...prev, status: 'active', check_out_requested: false, notice_period_start: null, notice_period_end: null }));
    try {
      const { error } = await supabase.from('check_out_requests').delete().eq('tenant_id', tenant.id);
      if (error) throw error;
      const { error: tenantError } = await supabase.from('tenants').update({
        status: 'active',
        check_out_requested: false,
        notice_period_start: null,
        notice_period_end: null,
      }).eq('id', tenant.id);
      if (tenantError) throw tenantError;
      toast.success('Vacate request cancelled. You remain active.');
    } catch (error) {
      console.error('Cancel vacate error:', error); toast.error('Failed to cancel request: ' + error.message);
      setExistingVacateRequest(prevRequest); setTenant(prevTenant);
    } finally { setIsSubmitting(false); }
  };

  useEffect(() => {
    if (!snapshotLoaded) return;
    applyVacateRequests(initialVacateRequests);
  }, [initialVacateRequests, snapshotLoaded]);

  useEffect(() => {
    if (!tenant?.id) return;
    if (!snapshotLoaded) {
      setVacateLoaded(false);
      loadVacate();
    }
    const channel = supabase.channel(`vacate-tenant-isolated:${tenant.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'check_out_requests', filter:`tenant_id=eq.${tenant.id}` }, (payload) => {
        const changedRequest = payload.new || payload.old;
        if (changedRequest?.tenant_id === tenant.id) {
          if (payload.eventType === 'UPDATE') {
            if (payload.new.status === 'approved') { setTenant(prev => ({ ...prev, status:'notice_period', check_out_requested:true, notice_period_start:new Date().toISOString().split('T')[0], notice_period_end:payload.new.expected_check_out })); toast.success('✅ Your vacate request was approved!'); }
            else if (payload.new.status === 'rejected') { toast.error(`Your vacate request was rejected.${payload.new.rejection_reason ? ` ${payload.new.rejection_reason}` : ''}`); }
          }
        }
        if (payload.eventType === 'DELETE') {
          setExistingVacateRequest(current => current?.id === changedRequest?.id ? null : current);
        } else if (payload.new) {
          if (['pending', 'approved'].includes(payload.new.status)) setExistingVacateRequest(payload.new);
          else setExistingVacateRequest(current => current?.id === payload.new.id ? null : current);
          if (payload.new.status === 'rejected') setLastVacateDecision(payload.new);
        }
        setVacateLoaded(true);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant?.id, snapshotLoaded]);

  return { existingVacateRequest, lastVacateDecision, vacateLoaded, cancelVacateRequest, isSubmitting, refreshVacate: loadVacate };
}
