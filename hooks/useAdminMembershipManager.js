import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

const OWNER_MEMBERSHIP_SELECT = 'id, full_name, email, phone, is_active, properties!properties_owner_id_fkey(id, name, membership_active, membership_expiry)';
const MEMBERSHIP_REQUEST_SELECT = [
  'id',
  'owner_id',
  'property_id',
  'plan_id',
  'amount',
  'status',
  'requested_at',
  'reviewed_at',
  'reviewed_by',
  'admin_note',
  'owner:users!membership_requests_owner_id_fkey(id, full_name, email, phone, is_active)',
  'property:properties!membership_requests_property_id_fkey(id, name, address, city, lifecycle_status, archived_at)',
].join(', ');

const normalizeMembershipRequest = request => ({
  ...request,
  owner: request.owner || {
    id: request.owner_id || null,
    full_name: 'Unknown owner',
    email: 'Not available',
    phone: 'Not available',
    is_active: false,
  },
  property: request.property || {
    id: request.property_id || null,
    name: 'No property linked',
    address: 'Not available',
    city: '',
  },
});

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
        .select(OWNER_MEMBERSHIP_SELECT)
        .eq('role', 'owner')
        .order('created_at', { ascending: false }),
      supabase
        .from('membership_requests')
        .select(MEMBERSHIP_REQUEST_SELECT)
        .eq('status', 'pending')
        .order('requested_at', { ascending: true }),
    ]);

    if (ownersResult.error) {
      console.error('Admin membership owners load failed:', ownersResult.error);
      toast.error('Failed to load membership owners.');
    } else {
      setOwners(ownersResult.data || []);
    }

    if (requestsResult.error) {
      console.error('Admin membership requests load failed:', requestsResult.error);
      toast.error('Failed to load membership requests.');
    } else {
      setRequests((requestsResult.data || []).map(normalizeMembershipRequest));
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
      setRequests(current => current.filter(request => request.id !== requestId));
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
