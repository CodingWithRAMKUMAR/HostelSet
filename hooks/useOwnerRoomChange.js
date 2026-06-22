import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useOwnerRoomChange(property) {
  const [roomChangeRequests, setRoomChangeRequests] = useState([]);

  const loadRoomChangeRequests = async () => {
    if (!property?.id) return;
    const { data } = await supabase.from('room_change_requests')
      .select('*, tenants:tenant_id (id, name, phone, email, room_id, rent_amount), old_room:old_room_id (id, room_number), new_room:new_room_id (id, room_number, capacity, current_occupants, monthly_rent)')
      .eq('property_id', property.id).eq('status', 'pending').order('requested_at', { ascending: false });
    setRoomChangeRequests(data || []);
  };

  const approveRoomChange = async (request) => {
    if (!confirm(`Approve room change?`)) return;
    const { error } = await supabase.rpc('move_tenant_room', { p_tenant_id: request.tenant_id, p_new_room_id: request.new_room_id, p_old_room_id: request.old_room_id });
    if (error) { toast.error('Failed to approve: ' + error.message); return false; }
    await supabase.from('room_change_requests').update({ status:'approved', processed_at:new Date().toISOString() }).eq('id', request.id);
    await supabase.from('check_out_requests').delete().eq('tenant_id', request.tenant_id);
    toast.success('Room change approved!');
    return true;
  };

  const rejectRoomChange = async (requestId, reason) => {
    if (!reason.trim()) { toast.error('Please provide a reason for rejection'); return false; }
    const { error } = await supabase.from('room_change_requests').update({ status:'rejected', processed_at:new Date().toISOString(), rejection_reason:reason }).eq('id', requestId);
    if (error) { toast.error('Failed to reject request'); return false; }
    toast.success('Room change request rejected.');
    return true;
  };

  useEffect(() => {
    if (!property?.id) return;
    loadRoomChangeRequests();
    const channel = supabase.channel('owner-roomchange')
      .on('postgres_changes', { event:'*', schema:'public', table:'room_change_requests' }, (payload) => {
        if (payload.new?.property_id === property.id) {
          if (payload.eventType === 'INSERT') setRoomChangeRequests(prev => [payload.new, ...prev]);
          else if (payload.eventType === 'UPDATE') {
            if (payload.new.status !== 'pending') setRoomChangeRequests(prev => prev.filter(r => r.id !== payload.new.id));
            else setRoomChangeRequests(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
          } else if (payload.eventType === 'DELETE') {
            setRoomChangeRequests(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [property?.id]);

  return { roomChangeRequests, approveRoomChange, rejectRoomChange };
}
