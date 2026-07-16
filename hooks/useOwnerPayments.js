import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { isPendingRentPayment } from '../lib/rentDue';

const PENDING_RENT_STATUSES = ['payment_pending', 'pending', 'pending_confirmation', 'pending_owner_verification'];

export function useOwnerPayments(property, tenants, archivedTenants, setStats, loadData, enabled = true, initialPayments = null) {
  const [pendingRentPayments, setPendingRentPayments] = useState(() => initialPayments?.pendingRentPayments || []);
  const [allPayments, setAllPayments] = useState(() => initialPayments?.allPayments || []);
  const loadedKeyRef = useRef(null);

  const activeTenantKey = useMemo(() => tenants.map(tenant => tenant.id).filter(Boolean).sort().join(','), [tenants]);
  const archivedTenantKey = useMemo(() => archivedTenants.map(tenant => tenant.id).filter(Boolean).sort().join(','), [archivedTenants]);

  useEffect(() => {
    if (!initialPayments || initialPayments.propertyId !== property?.id) return;
    setPendingRentPayments(initialPayments.pendingRentPayments || []);
    setAllPayments(initialPayments.allPayments || []);
    loadedKeyRef.current = `${property.id}:${activeTenantKey}:${archivedTenantKey}`;
  }, [initialPayments?.propertyId, initialPayments?.version, property?.id, activeTenantKey, archivedTenantKey]);

  const loadPayments = useCallback(async () => {
    if (!property?.id || !enabled) return;
    const activeTenantIds = tenants.map(t => t.id).filter(Boolean);
    const historyTenantIds = [...new Set([...activeTenantIds, ...archivedTenants.map(tenant => tenant.id).filter(Boolean)])];
    if (!historyTenantIds.length) {
      if (tenants.length || archivedTenants.length) {
        setPendingRentPayments([]);
        setAllPayments([]);
        loadedKeyRef.current = `${property.id}:${activeTenantKey}:${archivedTenantKey}`;
      }
      return;
    }
    const pendingQuery = supabase.from('payment_history').select('*, tenants(id, name, phone, email, room_id, profile_photo_path, rooms(room_number))').in('status', PENDING_RENT_STATUSES).order('payment_date', { ascending: false });
    const [pendingResult, allResult] = await Promise.all([
      activeTenantIds.length ? pendingQuery.in('tenant_id', activeTenantIds) : Promise.resolve({ data: [], error: null }),
      supabase.from('payment_history').select('*, tenants(id, name, phone, email, room_id, profile_photo_path, rooms(room_number))').in('tenant_id', historyTenantIds).order('payment_date', { ascending: false }).limit(100),
    ]);
    const { data: pending, error: pendingError } = pendingResult;
    const { data: all, error: allError } = allResult;
    if (pendingError) { console.error('Pending payments load failed:', pendingError); return; }
    if (allError) { console.error('Payment history load failed:', allError); return; }
    setPendingRentPayments((pending || []).filter(isPendingRentPayment));
    setAllPayments(all || []);
    loadedKeyRef.current = `${property.id}:${activeTenantKey}:${archivedTenantKey}`;
  }, [property?.id, enabled, tenants, archivedTenants, activeTenantKey, archivedTenantKey]);

  const confirmRentPayment = async (paymentId) => {
    const { data, error } = await supabase.rpc('review_rent_payment', { p_payment_id: paymentId, p_approve: true });
    if (error) { toast.error('Failed to confirm: ' + error.message); return false; }
    toast.success(data?.payment_type === 'security_deposit' ? 'Security deposit confirmed.' : 'Rent payment confirmed!');
    await loadData({ background: true, force: true, reason: 'confirm-rent-payment-reconciliation' });
    return true;
  };

  const rejectRentPayment = async (paymentId) => {
    if (!confirm('Reject this payment?')) return false;
    const { error } = await supabase.rpc('review_rent_payment', { p_payment_id: paymentId, p_approve: false });
    if (error) { toast.error('Failed to reject: ' + error.message); return false; }
    toast.success('Payment rejected.');
    await loadData({ background: true, force: true, reason: 'reject-rent-payment-reconciliation' });
    return true;
  };

  useEffect(() => {
    if (!property?.id || !enabled) return;
    const nextKey = `${property.id}:${activeTenantKey}:${archivedTenantKey}`;
    if (loadedKeyRef.current === nextKey) return;
    loadPayments();
  }, [property?.id, activeTenantKey, archivedTenantKey, enabled, loadPayments]);

  return { pendingRentPayments, allPayments, confirmRentPayment, rejectRentPayment, refreshPayments: loadPayments };
}
