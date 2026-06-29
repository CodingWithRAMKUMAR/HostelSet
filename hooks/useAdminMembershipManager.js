import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useAdminMembershipManager(enabled = true) {
  const [owners, setOwners] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const loadMemberships = useCallback(async (background = false) => {
    if (!enabled) return;
    if (!background) setLoading(true);
    const [ownersResult, requestsResult] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, email, phone, properties(id, name, membership_active, membership_expiry)')
        .eq('role', 'owner')
        .order('created_at', { ascending: false }),
      supabase
        .from('membership_requests')
        .select('id, owner_id, property_id, plan_id, amount, status, requested_at, admin_note, owner:owner_id(full_name, email, phone), property:property_id(name)')
        .eq('status', 'pending')
        .order('requested_at', { ascending: true }),
    ]);
    if (ownersResult.error || requestsResult.error) {
      toast.error('Failed to load memberships: ' + (ownersResult.error || requestsResult.error).message);
    } else {
      setOwners(ownersResult.data || []);
      setRequests(requestsResult.data || []);
    }
    setLoading(false);
  }, [enabled]);

  const reviewRequest = async (requestId, approve, note = '') => {
    if (processingId) return false;
    setProcessingId(requestId);
    try {
      const { error } = await supabase.rpc('review_membership_request', {
        p_request_id: requestId,
        p_approve: approve,
        p_admin_note: note || null,
      });
      if (error) throw error;
      toast.success(approve ? 'Membership approved and activated.' : 'Membership request rejected.');
      await loadMemberships(true);
      return true;
    } catch (error) {
      toast.error('Could not review request: ' + error.message);
      return false;
    } finally {
      setProcessingId(null);
    }
  };

  const grantMembership = async (ownerId, days) => {
    try {
      const { error } = await supabase.rpc('admin_set_owner_membership', { p_owner_id: ownerId, p_active: true, p_days: Number(days) });
      if (error) throw error;
      toast.success(`Membership extended by ${days} days.`);
      await loadMemberships(true);
      return true;
    } catch (error) {
      toast.error('Failed to grant membership: ' + error.message);
      return false;
    }
  };

  const revokeMembership = async (ownerId) => {
    if (!confirm('Revoke this owner membership immediately?')) return false;
    try {
      const { error } = await supabase.rpc('admin_set_owner_membership', { p_owner_id: ownerId, p_active: false, p_days: 30 });
      if (error) throw error;
      toast.success('Membership revoked.');
      await loadMemberships(true);
      return true;
    } catch (error) {
      toast.error('Failed to revoke membership: ' + error.message);
      return false;
    }
  };

  const getDaysLeft = (expiryDate) => expiryDate
    ? Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const sendRenewalEmail = async (ownerId, ownerName) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please log in again');
      const response = await fetch('/api/admin/send-renewal-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ownerId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Email service failed');
      toast.success(`Renewal email sent to ${ownerName}`);
    } catch (error) {
      toast.error('Failed to send renewal email: ' + error.message);
    }
  };

  useEffect(() => { if (enabled) loadMemberships(); }, [enabled, loadMemberships]);
  useRealtimeRefresh('admin-memberships-live', ['properties', 'users', 'membership_requests'], loadMemberships, enabled);

  return { owners, requests, loading, processingId, getDaysLeft, sendRenewalEmail, grantMembership, revokeMembership, reviewRequest, refresh: loadMemberships };
}
