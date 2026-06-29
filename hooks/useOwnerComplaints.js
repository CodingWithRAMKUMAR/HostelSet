import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useOwnerComplaints(property) {
  const [complaints, setComplaints] = useState([]);

  const loadComplaints = async () => {
    if (!property?.id) return;
    const { data } = await supabase.from('complaints').select('*').eq('property_id', property.id).in('status', ['open', 'in_progress']).order('created_at', { ascending: false });
    setComplaints(data || []);
  };

  const respondToComplaint = async (complaintId, response) => {
    const { error } = await supabase.from('complaints').update({ status:'in_progress', admin_response:response, responded_at:new Date().toISOString() }).eq('id', complaintId);
    if (error) { toast.error('Failed to send response'); return false; }
    toast.success('Response sent'); return true;
  };

  const resolveComplaint = async (complaintId) => {
    if (!confirm('Mark as resolved?')) return;
    const { error } = await supabase.from('complaints').update({ status:'resolved', resolved_at:new Date().toISOString() }).eq('id', complaintId);
    if (error) { toast.error('Failed to resolve'); return false; }
    toast.success('Complaint resolved'); return true;
  };

  useEffect(() => {
    if (property?.id) loadComplaints();
  }, [property?.id]);
  useRealtimeRefresh(`owner-complaints-live:${property?.id || 'waiting'}`, ['complaints'], loadComplaints, Boolean(property?.id));

  return { complaints, respondToComplaint, resolveComplaint };
}
