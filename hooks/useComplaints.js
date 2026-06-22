import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useComplaints(tenant) {
  const [complaints, setComplaints] = useState([]);
  const loadComplaints = async () => {
    if (!tenant?.id) return;
    const { data } = await supabase.from('complaints').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    setComplaints(data || []);
  };
  const submitComplaint = async (formData) => {
    if (!formData.title || !formData.description) { toast.error('Please fill all fields'); return false; }
    const { error } = await supabase.from('complaints').insert({ tenant_id:tenant.id, property_id:tenant.property_id, room_id:tenant.room_id, tenant_name:tenant.name, room_number:tenant.rooms?.room_number, title:formData.title, description:formData.description, priority:formData.priority, status:'open', created_at:new Date().toISOString() });
    if (error) { toast.error('Failed to submit complaint: ' + error.message); return false; }
    toast.success('Complaint submitted successfully!'); return true;
  };
  const deleteComplaint = async (complaintId) => {
    if (!confirm('Delete this complaint?')) return;
    setComplaints(prev => prev.filter(c => c.id !== complaintId));
    const { error } = await supabase.from('complaints').delete().eq('id', complaintId).eq('tenant_id', tenant.id);
    if (error) { toast.error('Failed to delete complaint: ' + error.message); await loadComplaints(); return; }
    toast.success('Complaint deleted.');
  };
  useEffect(() => {
    if (!tenant?.id) return;
    loadComplaints();
    const channel = supabase.channel('complaints-tenant-isolated')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'complaints' }, (payload) => { if (payload.new?.tenant_id === tenant.id) setComplaints(prev => [payload.new, ...prev]); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'complaints' }, (payload) => {
        if (payload.new?.tenant_id === tenant.id) {
          setComplaints(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
          if (payload.new.status !== payload.old?.status) toast.success(`📝 Complaint status updated to: ${payload.new.status}`);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'complaints' }, (payload) => { if (payload.old?.tenant_id === tenant.id) setComplaints(prev => prev.filter(c => c.id !== payload.old.id)); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant?.id]);
  return { complaints, submitComplaint, deleteComplaint };
}
