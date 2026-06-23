import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useOwnerComplaints(property) {
  const [complaints, setComplaints] = useState([]);

  const loadComplaints = async () => {
    if (!property?.id) return;
    const { data } = await supabase.from('complaints').select('*').eq('property_id', property.id).eq('status', 'open').order('created_at', { ascending: false });
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
    if (!property?.id) return;
    loadComplaints();
    const channel = supabase.channel('owner-complaints')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'complaints' }, (payload) => {
        if (payload.new?.property_id === property.id) setComplaints(prev => [payload.new, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [property?.id]);

  return { complaints, respondToComplaint, resolveComplaint };
}
