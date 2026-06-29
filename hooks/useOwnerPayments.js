import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useOwnerPayments(property, tenants, setStats, loadData) {
  const [pendingRentPayments, setPendingRentPayments] = useState([]);
  const [allPayments, setAllPayments] = useState([]);

  const loadPayments = async () => {
    if (!property?.id) return;
    const tenantIds = tenants.map(t => t.id);
    if (!tenantIds.length) {
      setPendingRentPayments([]);
      setAllPayments([]);
      return;
    }
    const { data: pending } = await supabase.from('payment_history').select('*, tenants(name, phone, room_id, rooms(room_number))').eq('status', 'payment_pending').in('tenant_id', tenantIds).order('payment_date', { ascending: false });
    setPendingRentPayments(pending || []);
    const { data: all } = await supabase.from('payment_history').select('*, tenants(name, room_id, rooms(room_number))').in('tenant_id', tenantIds).order('payment_date', { ascending: false }).limit(100);
    setAllPayments(all || []);
  };

  const confirmRentPayment = async (paymentId, tenantId, amount) => {
    const { error } = await supabase.from('payment_history').update({ status:'success' }).eq('id', paymentId);
    if (error) { toast.error('Failed to confirm: ' + error.message); return; }
    const { data: tenant } = await supabase.from('tenants').select('total_paid, pending_amount, rent_amount').eq('id', tenantId).single();
    if (tenant) {
      const newTotalPaid = (tenant.total_paid||0)+amount;
      const newPending = Math.max(0, (tenant.pending_amount||0)-amount);
      const newStatus = newPending <= 0 ? 'paid':'pending';
      await supabase.from('tenants').update({ total_paid:newTotalPaid, pending_amount:newPending, rent_status:newStatus, last_payment_date:new Date().toISOString().split('T')[0] }).eq('id', tenantId);
    }
    toast.success('✅ Rent payment confirmed!');
    await loadData(true);
  };

  const rejectRentPayment = async (paymentId) => {
    if (!confirm('Reject this payment?')) return;
    const { error } = await supabase.from('payment_history').delete().eq('id', paymentId);
    if (error) { toast.error('Failed to reject: ' + error.message); return; }
    toast.success('Payment rejected.');
    await loadData(true);
  };

  useEffect(() => {
    if (property?.id) loadPayments();
  }, [property?.id, tenants.map((tenant) => tenant.id).join(',')]);
  useRealtimeRefresh(`owner-payments-live:${property?.id || 'waiting'}`, ['payment_history', 'tenants', 'rooms'], loadPayments, Boolean(property?.id));

  return { pendingRentPayments, allPayments, confirmRentPayment, rejectRentPayment };
}
