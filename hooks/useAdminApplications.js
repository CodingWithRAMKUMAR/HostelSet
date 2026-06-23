import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useAdminApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadApplications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('applications')
      .select('*, rooms(room_number, monthly_rent, property_id)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load applications');
    else setApplications(data || []);
    setLoading(false);
  };

  const approveApplication = async (app, userId) => {
    if (!confirm('Approve this application?')) return;
    const room = app.rooms; if (!room) { toast.error('Room data not found'); return; }
    const moveInDate = new Date(); moveInDate.setDate(moveInDate.getDate() + 7);
    const { error: tenantError } = await supabase.from('tenants').insert({
      user_id: userId, property_id: room.property_id, room_id: app.room_id,
      name: app.name, phone: app.phone, email: app.email,
      rent_amount: room.monthly_rent, pending_amount: room.monthly_rent,
      total_paid: 0, rent_status: 'pending', move_in_date: moveInDate.toISOString().split('T')[0],
      status: 'active'
    });
    if (tenantError) { toast.error('Failed to create tenant: ' + tenantError.message); return; }
    await supabase.from('rooms').update({ current_occupants: 1, status: 'occupied' }).eq('id', app.room_id);
    await supabase.from('applications').update({ status: 'approved', processed_at: new Date() }).eq('id', app.id);
    toast.success('Application approved! Tenant created.');
    await loadApplications();
  };

  const rejectApplication = async (appId) => {
    if (!confirm('Reject this application?')) return;
    const { error } = await supabase.from('applications').update({ status: 'rejected' }).eq('id', appId);
    if (error) toast.error('Failed to reject application');
    else { toast.success('Application rejected.'); await loadApplications(); }
  };

  useEffect(() => { loadApplications(); }, []);
  return { applications, loading, approveApplication, rejectApplication, refreshApplications: loadApplications };
}
