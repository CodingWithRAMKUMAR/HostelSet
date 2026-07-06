import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useOwnerComplaints(property, enabled = true) {
  const [complaints, setComplaints] = useState([]);

  const loadComplaints = async () => {
    if (!property?.id) return;
    const { data, error } = await supabase.from('complaints').select('*').eq('property_id', property.id).in('status', ['open', 'in_progress']).order('created_at', { ascending: false });
    if (error) throw error;
    setComplaints(data || []);
  };

  const respondToComplaint = async (complaintId, response) => {
    const cleanResponse = response?.trim();
    if (!cleanResponse) { toast.error('Please enter a response'); return false; }
    const { data, error } = await supabase
      .from('complaints')
      .update({ status:'in_progress', admin_response:cleanResponse, responded_at:new Date().toISOString() })
      .eq('id', complaintId)
      .eq('property_id', property.id)
      .eq('status', 'open')
      .select('id')
      .maybeSingle();
    if (error || !data) { toast.error(error?.message || 'This complaint was already updated'); return false; }
    await loadComplaints();
    toast.success('Response sent');
    return true;
  };

  const resolveComplaint = async (complaintId) => {
    if (!confirm('Mark as resolved?')) return;
    const { error } = await supabase.from('complaints').update({ status:'resolved', resolved_at:new Date().toISOString() }).eq('id', complaintId);
    if (error) { toast.error('Failed to resolve'); return false; }
    await loadComplaints();
    toast.success('Complaint resolved'); return true;
  };

  useEffect(() => {
    setComplaints([]);
    if (property?.id && enabled) loadComplaints();
  }, [property?.id, enabled]);
  useRealtimeRefresh(`owner-complaints-live:${property?.id || 'waiting'}`, ['complaints'], loadComplaints, Boolean(property?.id && enabled));

  return { complaints, respondToComplaint, resolveComplaint };
}
