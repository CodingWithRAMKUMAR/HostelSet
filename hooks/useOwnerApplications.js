import { useState, useEffect } from 'react';
import { supabase, signPrivateDocumentFields } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useOwnerApplications(property, enabled = true) {
  const [applications, setApplications] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  const loadApplications = async () => {
    if (!property?.id) return;
    const { data, error } = await supabase
      .from('applications')
      .select('*, rooms(room_number, monthly_rent, deposit_amount, capacity)')
      .eq('property_id', property.id)
      .eq('status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) { console.error('Owner applications load failed:', error.message); return; }
    const signed = await Promise.all((data || []).map(item => signPrivateDocumentFields({ ...item, source_type: 'application' }, ['id_proof', 'photo', 'payment_screenshot'])));
    setApplications(signed);
  };

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
    const { error } = await supabase
      .from('applications')
      .update({ status: 'rejected', processed_at: new Date().toISOString() })
      .eq('id', appId);
    if (error) toast.error('Failed to reject application: ' + error.message);
    else { toast.success('Application rejected.'); await loadApplications(); }
  };

  const resendPasswordEmail = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
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
  }, [property?.id, enabled]);
  useRealtimeRefresh(`owner-applications-live:${property?.id || 'waiting'}`, ['applications', 'rooms'], loadApplications, Boolean(property?.id && enabled));

  return { applications, approveApplication, rejectApplication, resendPasswordEmail, processingId };
}
