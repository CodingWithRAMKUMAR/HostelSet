import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useComplaints(tenant, initialComplaints = null, snapshotLoaded = false) {
  const [complaints, setComplaints] = useState([]);
  const loadComplaints = async () => {
    if (!tenant?.id) return;
    const { data } = await supabase.from('complaints').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    setComplaints(data || []);
  };
  useEffect(() => {
    if (!snapshotLoaded) return;
    setComplaints(Array.isArray(initialComplaints) ? initialComplaints : []);
  }, [initialComplaints, snapshotLoaded]);
  const submitComplaint = async (formData) => {
    if (!formData.title || !formData.description) { toast.error('Please fill all fields'); return false; }
    const { data, error } = await supabase.from('complaints').insert({ tenant_id:tenant.id, property_id:tenant.property_id, room_id:tenant.room_id, tenant_name:tenant.name, room_number:tenant.rooms?.room_number, title:formData.title, description:formData.description, priority:formData.priority, status:'open', created_at:new Date().toISOString() }).select('*').single();
    if (error) { toast.error('Failed to submit complaint: ' + error.message); return false; }
    if (data) setComplaints(prev => [data, ...prev]);
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
    if (!snapshotLoaded) loadComplaints();
    const channel = supabase.channel(`tenant:${tenant.id}:complaints`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints', filter: `tenant_id=eq.${tenant.id}` }, (payload) => {
        if (payload.new?.tenant_id === tenant.id) {
          if (payload.eventType === 'UPDATE' && payload.new.status !== payload.old?.status) {
            toast.success(`📝 Complaint status updated to: ${payload.new.status}`);
          }
        }
        setComplaints(current => {
          const changedComplaint = payload.new || payload.old;
          if (payload.eventType === 'DELETE') return current.filter(complaint => complaint.id !== changedComplaint?.id);
          if (!payload.new) return current;
          const index = current.findIndex(complaint => complaint.id === payload.new.id);
          if (index === -1) return [payload.new, ...current];
          return current.map(complaint => complaint.id === payload.new.id ? { ...complaint, ...payload.new } : complaint);
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenant?.id, snapshotLoaded]);
  return { complaints, submitComplaint, deleteComplaint };
}
