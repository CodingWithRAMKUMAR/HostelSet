import { useCallback, useEffect, useRef, useState } from 'react';
import { getResetPasswordRedirectTo, supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useOwnerApplications(property, enabled = true) {
  const [applications, setApplications] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  const refreshTimer = useRef();

  const loadApplications = useCallback(async () => {
    if (!property?.id) return;
    const { data, error } = await supabase
      .from('applications')
      .select('*, rooms(room_number, monthly_rent, deposit_amount, capacity)')
      .eq('property_id', property.id)
      .eq('status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) { console.error('Owner applications load failed:', error.message); return; }
    const prepared = (data || []).map(item => {
      const { id_proof, photo, payment_screenshot, ...application } = item;
      return {
        ...application,
        id_proof,
        photo,
        payment_screenshot,
        source_type: 'application',
        payment_transaction_id: item.payment_transaction_id || item.upi_transaction_id || '',
        payment_status: item.payment_status || 'pending_owner_verification',
        payment_date: item.payment_date || item.created_at,
      };
    });
    setApplications(prepared);
  }, [property?.id]);

  const approveApplication = async (appId, appData) => {
    if (processingId) return;
    if (!appData || typeof appData !== 'object') {
      toast.error('Cannot approve: Application data is missing.');
      return;
    }

    try {
      setProcessingId(appId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Please log in again.');
      const response = await fetch('/api/requests/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: 'application', id: appId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Approval failed');
      toast.success(result.setupEmailSent ? 'Application approved and password setup email sent.' : 'Application approved successfully.');
      await loadApplications();
    } catch (error) {
      console.error('Approve error:', error);
      toast.error('Failed to approve: ' + error.message);
    } finally { setProcessingId(null); }
  };

  const rejectApplication = async (appId) => {
    if (!confirm('Reject this application?')) return;
    const { error } = await supabase.rpc('reject_application', { p_application_id: appId, p_reason: null });
    if (error) toast.error('Failed to reject application: ' + error.message);
    else { toast.success('Application rejected.'); await loadApplications(); }
  };

  const resendPasswordEmail = async (email) => {
    try {
      const redirectTo = getResetPasswordRedirectTo();
      if (process.env.NODE_ENV !== 'production') {
        console.info('[HostelSet] reset link requested', { method: 'resetPasswordForEmail', redirectTo });
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;
      toast.success(`Password reset email resent to ${email}`);
    } catch (error) {
      console.error('Resend error:', error);
      toast.error('Failed to resend: ' + error.message);
    }
  };

  useEffect(() => {
    setApplications([]);
    if (property?.id && enabled) loadApplications();
  }, [property?.id, enabled, loadApplications]);
  useEffect(() => {
    if (!property?.id || !enabled) return undefined;
    const channel = supabase
      .channel(`owner-applications:${property.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications', filter: `property_id=eq.${property.id}` }, () => {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(loadApplications, 150);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `property_id=eq.${property.id}` }, () => {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(loadApplications, 150);
      })
      .subscribe();
    return () => { clearTimeout(refreshTimer.current); supabase.removeChannel(channel); };
  }, [property?.id, enabled, loadApplications]);

  return { applications, approveApplication, rejectApplication, resendPasswordEmail, processingId };
}
