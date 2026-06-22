import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useAdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadComplaints = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('complaints').select('*, tenants(name, phone)').order('created_at', { ascending: false });
    if (error) toast.error('Failed to load complaints');
    else setComplaints(data || []);
    setLoading(false);
  };

  const resolveComplaint = async (complaintId) => {
    if (!confirm('Mark this complaint as resolved?')) return;
    const { error } = await supabase.from('complaints').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', complaintId);
    if (error) toast.error('Failed to resolve complaint');
    else { toast.success('Complaint resolved.'); await loadComplaints(); }
  };

  const deleteComplaint = async (complaintId) => {
    if (!confirm('Permanently delete this complaint?')) return;
    const { error } = await supabase.from('complaints').delete().eq('id', complaintId);
    if (error) toast.error('Failed to delete complaint');
    else { toast.success('Complaint deleted.'); await loadComplaints(); }
  };

  useEffect(() => {
    loadComplaints();
    const channel = supabase.channel('admin-complaints')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, (payload) => {
        if (payload.eventType === 'INSERT') setComplaints(prev => [payload.new, ...prev]);
        else if (payload.eventType === 'UPDATE') setComplaints(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
        else if (payload.eventType === 'DELETE') setComplaints(prev => prev.filter(c => c.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
  return { complaints, loading, resolveComplaint, deleteComplaint, refreshComplaints: loadComplaints };
}
