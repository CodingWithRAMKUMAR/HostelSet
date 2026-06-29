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
    try {
      const moveInDate = app.expected_move_in || new Date().toISOString().split('T')[0];
      const { data: existingTenant, error: existingError } = await supabase
        .from('tenants')
        .select('id, status, room_id, user_id')
        .eq('phone', app.phone)
        .eq('property_id', room.property_id)
        .maybeSingle();
      if (existingError) throw existingError;

      let occupancyAlreadyCounted = false;
      if (existingTenant) {
        if (existingTenant.status !== 'payment_pending' || existingTenant.room_id !== app.room_id) {
          throw new Error('This applicant already has a tenant record.');
        }
        const { error } = await supabase.from('tenants').update({
          status: 'active',
          user_id: existingTenant.user_id || userId,
          move_in_date: moveInDate,
        }).eq('id', existingTenant.id);
        if (error) throw error;
        occupancyAlreadyCounted = true;
      } else {
        if (!userId) {
          const { data: existingUser, error: userError } = await supabase
            .from('users')
            .select('id')
            .or(`phone.eq.${app.phone},email.eq.${app.email}`)
            .maybeSingle();
          if (userError) throw userError;
          userId = existingUser?.id;
        }
        if (!userId) throw new Error('Applicant account not found.');

        const { error: tenantError } = await supabase.from('tenants').insert({
          user_id: userId, property_id: room.property_id, room_id: app.room_id,
          name: app.name, phone: app.phone, email: app.email,
          rent_amount: room.monthly_rent, pending_amount: room.monthly_rent,
          total_paid: 0, rent_status: 'pending', move_in_date: moveInDate,
          status: 'active'
        });
        if (tenantError) throw tenantError;
      }

      if (!occupancyAlreadyCounted) {
        const { data: roomData, error: roomError } = await supabase.from('rooms').select('current_occupants, capacity').eq('id', app.room_id).single();
        if (roomError) throw roomError;
        if ((roomData.current_occupants || 0) >= roomData.capacity) throw new Error('The selected room is already full.');
        const occupants = (roomData.current_occupants || 0) + 1;
        const { error: updateRoomError } = await supabase.from('rooms').update({ current_occupants: occupants, status: occupants >= roomData.capacity ? 'occupied' : 'vacant' }).eq('id', app.room_id);
        if (updateRoomError) throw updateRoomError;
      }

      const { error: appError } = await supabase.from('applications').update({ status: 'approved', processed_at: new Date().toISOString() }).eq('id', app.id);
      if (appError) throw appError;
      toast.success('Application approved! Tenant activated.');
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

  useEffect(() => { loadApplications(); }, []);
  return { applications, loading, approveApplication, rejectApplication, refreshApplications: loadApplications };
}
