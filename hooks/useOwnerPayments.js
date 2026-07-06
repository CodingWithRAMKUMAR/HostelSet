import { useState, useEffect } from 'react';
import { signPrivateDocumentFields, supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useOwnerPayments(property, tenants, archivedTenants, setStats, loadData, enabled = true) {
  const [pendingRentPayments, setPendingRentPayments] = useState([]);
  const [allPayments, setAllPayments] = useState([]);

  const loadPayments = async () => {
    if (!property?.id) return;
    const activeTenantIds = tenants.map(t => t.id);
    const historyTenantIds = [...new Set([...activeTenantIds, ...archivedTenants.map(tenant => tenant.id)])];
    if (!historyTenantIds.length) {
      setPendingRentPayments([]);
      setAllPayments([]);
      return;
    }
    const pendingQuery = supabase.from('payment_history').select('*, tenants(name, phone, email, room_id, rooms(room_number))').eq('status', 'payment_pending').order('payment_date', { ascending: false });
    const { data: pending, error: pendingError } = activeTenantIds.length ? await pendingQuery.in('tenant_id', activeTenantIds) : { data: [], error: null };
    if (pendingError) { console.error('Pending payments load failed:', pendingError); return; }
    setPendingRentPayments(await Promise.all((pending || []).map(payment => signPrivateDocumentFields(payment, ['payment_screenshot']))));
    const { data: all, error: allError } = await supabase.from('payment_history').select('*, tenants(name, phone, email, room_id, rooms(room_number))').in('tenant_id', historyTenantIds).order('payment_date', { ascending: false }).limit(100);
    if (allError) { console.error('Payment history load failed:', allError); return; }
    setAllPayments(all || []);
  };

  const confirmRentPayment = async (paymentId) => {
    const { data, error } = await supabase.rpc('review_rent_payment', { p_payment_id: paymentId, p_approve: true });
    if (error) { toast.error('Failed to confirm: ' + error.message); return false; }
    toast.success(data?.payment_type === 'security_deposit' ? 'Security deposit confirmed.' : 'Rent payment confirmed!');
    await Promise.all([loadPayments(), loadData(true)]);
    return true;
  };

  const rejectRentPayment = async (paymentId) => {
    if (!confirm('Reject this payment?')) return false;
    const { error } = await supabase.rpc('review_rent_payment', { p_payment_id: paymentId, p_approve: false });
    if (error) { toast.error('Failed to reject: ' + error.message); return false; }
    toast.success('Payment rejected.');
    await Promise.all([loadPayments(), loadData(true)]);
    return true;
  };

  useEffect(() => {
    setPendingRentPayments([]);
    setAllPayments([]);
    if (property?.id && enabled) loadPayments();
  }, [property?.id, tenants.map((tenant) => tenant.id).join(','), archivedTenants.map((tenant) => tenant.id).join(','), enabled]);
  useRealtimeRefresh(`owner-payments-live:${property?.id || 'waiting'}`, ['payment_history', 'tenants', 'rooms'], loadPayments, Boolean(property?.id && enabled));

  return { pendingRentPayments, allPayments, confirmRentPayment, rejectRentPayment, refreshPayments: loadPayments };
}
