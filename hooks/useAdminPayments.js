import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useAdminPayments(enabled = true) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPayments = async (background = false) => {
    if (!background) setLoading(true);
    const { data, error } = await supabase
      .from('payment_history')
      .select('*, tenants(name, phone, room_id, rooms(room_number))')
      .order('payment_date', { ascending: false });
    if (error) toast.error('Failed to load payments');
    else setPayments(data || []);
    setLoading(false);
  };

  const confirmPayment = async (paymentId, tenantId, amount) => {
    const { error } = await supabase.from('payment_history').update({ status: 'success' }).eq('id', paymentId);
    if (error) { toast.error('Failed to confirm: ' + error.message); return; }
    const { data: tenant } = await supabase.from('tenants').select('total_paid, pending_amount, rent_amount').eq('id', tenantId).single();
    if (tenant) {
      const newTotalPaid = (tenant.total_paid || 0) + amount;
      const newPending = Math.max(0, (tenant.pending_amount || 0) - amount);
      const newStatus = newPending <= 0 ? 'paid' : 'pending';
      await supabase.from('tenants').update({ total_paid: newTotalPaid, pending_amount: newPending, rent_status: newStatus }).eq('id', tenantId);
    }
    toast.success('✅ Payment confirmed!');
    await loadPayments();
  };

  const rejectPayment = async (paymentId) => {
    if (!confirm('Reject this payment? The record will be deleted.')) return;
    const { error } = await supabase.from('payment_history').delete().eq('id', paymentId);
    if (error) toast.error('Failed to reject: ' + error.message);
    else { toast.success('Payment rejected.'); await loadPayments(); }
  };

  useEffect(() => { if (enabled) loadPayments(); }, [enabled]);
  useRealtimeRefresh('admin-payments-live', ['payment_history', 'tenants', 'rooms'], loadPayments, enabled);
  return { payments, loading, confirmPayment, rejectPayment, refreshPayments: loadPayments };
}
