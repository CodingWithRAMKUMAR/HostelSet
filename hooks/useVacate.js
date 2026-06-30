import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useVacate(tenant, setTenant) {
  const [existingVacateRequest, setExistingVacateRequest] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadVacate = async () => {
    if (!tenant?.id) return;
    const { data, error } = await supabase.from('check_out_requests').select('*').eq('tenant_id', tenant.id).in('status', ['pending', 'approved']).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) { console.error('Vacate status load failed:', error); return; }
    setExistingVacateRequest(data || null);
    if (data?.status === 'approved') setTenant(prev => ({ ...prev, status:'notice_period', check_out_requested:true, notice_period_end:data.expected_check_out }));
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
    if (!tenant?.id) return;
    loadVacate();
    const channel = supabase.channel(`vacate-tenant-isolated:${tenant.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'check_out_requests', filter:`tenant_id=eq.${tenant.id}` }, (payload) => {
        const changedRequest = payload.new || payload.old;
        if (changedRequest?.tenant_id === tenant.id) {
          if (payload.eventType === 'UPDATE') {
            if (payload.new.status === 'approved') { setTenant(prev => ({ ...prev, status:'notice_period', check_out_requested:true, notice_period_start:new Date().toISOString().split('T')[0], notice_period_end:payload.new.expected_check_out })); toast.success('✅ Your vacate request was approved!'); }
            else if (payload.new.status === 'rejected') { setTenant(prev => ({ ...prev, status:'active' })); toast.error('❌ Your vacate request was rejected.'); }
          }
        }
        loadVacate();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant?.id]);

  return { existingVacateRequest, cancelVacateRequest, isSubmitting, refreshVacate: loadVacate };
}
