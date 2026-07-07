import { useState, useEffect } from 'react';
import { supabase, signPrivateDocumentFields } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useAdminApplications(enabled = true) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadApplications = async (background = false) => {
    if (!background) setLoading(true);
    const { data, error } = await supabase
      .from('applications')
      .select('*, rooms(room_number, monthly_rent, property_id)')
      .eq('status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load applications');
    else setApplications(await Promise.all((data || []).map(item => signPrivateDocumentFields({ ...item, source_type: 'application' }, ['id_proof', 'photo', 'payment_screenshot']))));
    setLoading(false);
  };

  const approveApplication = async (app, userId) => {
    if (!confirm('Approve this application?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Please log in again.');
      const response = await fetch('/api/requests/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: 'application', id: app.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Approval failed');
      toast.success(result.emailSent ? 'Application approved and password email sent.' : 'Application approved; password email needs resending.');
      await loadApplications();
    } catch (error) {
      toast.error('Failed to approve application: ' + error.message);
    }
  };

  const rejectApplication = async (appId) => {
    if (!confirm('Reject this application?')) return;
    const { error } = await supabase.from('applications').update({ status: 'rejected' }).eq('id', appId);
    if (error) toast.error('Failed to reject application');
    else { toast.success('Application rejected.'); await loadApplications(); }
  };

  useEffect(() => { if (enabled) loadApplications(); }, [enabled]);
  useRealtimeRefresh('admin-applications-live', ['applications', 'rooms'], loadApplications, enabled);
  return { applications, loading, approveApplication, rejectApplication, refreshApplications: loadApplications };
}
