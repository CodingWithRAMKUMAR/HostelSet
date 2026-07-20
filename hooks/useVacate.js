import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const DEFAULT_BLOCKED_REASON = 'This vacate request can no longer be cancelled because the room has already been reserved for another tenant.';

export function useVacate(tenant, setTenant, initialVacateRequests = [], snapshotLoaded = false) {
  const [existingVacateRequest, setExistingVacateRequest] = useState(null);
  const [lastVacateDecision, setLastVacateDecision] = useState(null);
  const [vacateLoaded, setVacateLoaded] = useState(snapshotLoaded);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelBlockedReason, setCancelBlockedReason] = useState('');

  const loadCancellationStatus = async request => {
    if (!request?.id || request.status !== 'approved') {
      setCancelBlockedReason('');
      return;
    }

    const { data, error } = await supabase.rpc('get_vacate_cancellation_status', {
      p_request_id: request.id,
    });

    if (error) {
      console.error('Vacate cancellation status load failed:', error);
      setCancelBlockedReason('Cancellation availability could not be verified. Please refresh and try again.');
      return;
    }

    setCancelBlockedReason(data?.can_cancel === false ? (data.reason || DEFAULT_BLOCKED_REASON) : '');
  };

  const applyVacateRequests = requests => {
    const activeRequest = requests.find(request => ['pending', 'approved'].includes(request.status)) || null;
    setExistingVacateRequest(activeRequest);
    setLastVacateDecision(requests[0]?.status === 'rejected' ? requests[0] : null);
    setVacateLoaded(true);
    loadCancellationStatus(activeRequest);
    if (activeRequest?.status === 'approved') {
      setTenant(prev => ({ ...prev, status:'notice_period', check_out_requested:true, notice_period_end:activeRequest.expected_check_out }));
    }
  };

  const loadVacate = async () => {
    if (!tenant?.id) return;
    const { data, error } = await supabase.from('check_out_requests').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(10);
    if (error) { console.error('Vacate status load failed:', error); return; }
    applyVacateRequests(data || []);
  };

  const cancelVacateRequest = async () => {
    if (isSubmitting) return;
    if (!existingVacateRequest) { toast.error('No vacate request to cancel.'); return; }
    if (cancelBlockedReason) { toast.error(cancelBlockedReason); return; }
    if (!confirm('Cancel your vacate request?')) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('cancel_vacate_request', {
        p_request_id: existingVacateRequest.id,
      });
      if (error) throw error;
      if (data?.success !== true) throw new Error(data?.message || 'Vacate request could not be cancelled');

      setExistingVacateRequest(null);
      setCancelBlockedReason('');
      setTenant(prev => ({ ...prev, status: 'active', check_out_requested: false, notice_period_start: null, notice_period_end: null }));
      toast.success('Vacate request cancelled. You remain active.');
    } catch (error) {
      console.error('Cancel vacate error:', error);
      const message = error?.message || 'Failed to cancel request';
      if (/reserved|pre-book|prebook/i.test(message)) setCancelBlockedReason(DEFAULT_BLOCKED_REASON);
      toast.error(message);
      await loadVacate();
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!snapshotLoaded) return;
    applyVacateRequests(initialVacateRequests || []);
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
        if (changedRequest?.tenant_id === tenant.id && payload.eventType === 'UPDATE') {
          if (payload.new.status === 'approved') { setTenant(prev => ({ ...prev, status:'notice_period', check_out_requested:true, notice_period_start:new Date().toISOString().split('T')[0], notice_period_end:payload.new.expected_check_out })); toast.success('✅ Your vacate request was approved!'); }
          else if (payload.new.status === 'rejected') { toast.error(`Your vacate request was rejected.${payload.new.rejection_reason ? ` ${payload.new.rejection_reason}` : ''}`); }
        }
        loadVacate();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant?.id, snapshotLoaded]);

  return { existingVacateRequest, lastVacateDecision, vacateLoaded, cancelVacateRequest, cancelBlockedReason, isSubmitting, refreshVacate: loadVacate };
}
