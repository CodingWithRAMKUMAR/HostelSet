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

  const confirmPayment = async (paymentId) => {
    const { error } = await supabase.rpc('review_rent_payment', { p_payment_id: paymentId, p_approve: true });
    if (error) { toast.error('Failed to confirm: ' + error.message); return; }
    toast.success('✅ Payment confirmed!');
    await loadPayments();
  };

  const rejectPayment = async (paymentId) => {
    if (!confirm('Reject this payment? The record will be deleted.')) return;
    const { error } = await supabase.rpc('review_rent_payment', { p_payment_id: paymentId, p_approve: false });
    if (error) toast.error('Failed to reject: ' + error.message);
    else { toast.success('Payment rejected.'); await loadPayments(); }
  };

  useEffect(() => { if (enabled) loadPayments(); }, [enabled]);
  useRealtimeRefresh('admin-payments-live', ['payment_history', 'tenants', 'rooms'], loadPayments, enabled);
  return { payments, loading, confirmPayment, rejectPayment, refreshPayments: loadPayments };
}
