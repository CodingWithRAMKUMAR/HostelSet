import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useOwnerPayments(property, tenants, setStats, loadData, enabled = true) {
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

  const confirmRentPayment = async (paymentId) => {
    const { error } = await supabase.rpc('review_rent_payment', { p_payment_id: paymentId, p_approve: true });
    if (error) { toast.error('Failed to confirm: ' + error.message); return; }
    toast.success('✅ Rent payment confirmed!');
    await Promise.all([loadPayments(), loadData(true)]);
  };

  const rejectRentPayment = async (paymentId) => {
    if (!confirm('Reject this payment?')) return;
    const { error } = await supabase.rpc('review_rent_payment', { p_payment_id: paymentId, p_approve: false });
    if (error) { toast.error('Failed to reject: ' + error.message); return; }
    toast.success('Payment rejected.');
    await Promise.all([loadPayments(), loadData(true)]);
  };

  useEffect(() => {
    if (property?.id && enabled) loadPayments();
  }, [property?.id, tenants.map((tenant) => tenant.id).join(','), enabled]);
  useRealtimeRefresh(`owner-payments-live:${property?.id || 'waiting'}`, ['payment_history', 'tenants', 'rooms'], loadPayments, Boolean(property?.id && enabled));

  return { pendingRentPayments, allPayments, confirmRentPayment, rejectRentPayment };
}
