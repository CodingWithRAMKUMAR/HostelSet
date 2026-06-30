import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useOwnerRoomChange(property, enabled = true) {
  const [roomChangeRequests, setRoomChangeRequests] = useState([]);

  const loadRoomChangeRequests = async () => {
    if (!property?.id) return;
    const { data, error } = await supabase.from('room_change_requests')
      .select('*, tenants:tenant_id (id, name, phone, email, room_id, rent_amount), old_room:old_room_id (id, room_number), new_room:new_room_id (id, room_number, capacity, current_occupants, monthly_rent)')
      .eq('property_id', property.id).eq('status', 'pending').order('requested_at', { ascending: false });
    if (error) throw error;
    setRoomChangeRequests(data || []);
  };

  const approveRoomChange = async (request) => {
    if (!confirm(`Approve room change?`)) return;
    const { error } = await supabase.rpc('move_tenant_room', { p_tenant_id: request.tenant_id, p_new_room_id: request.new_room_id, p_old_room_id: request.old_room_id });
    if (error) { toast.error('Failed to approve: ' + error.message); return false; }
    const { error: requestError } = await supabase.from('room_change_requests').update({ status:'approved', processed_at:new Date().toISOString(), rejection_reason:null }).eq('id', request.id).eq('status', 'pending');
    if (requestError) { toast.error('Room moved, but request status could not be updated: ' + requestError.message); return false; }
    await supabase.from('check_out_requests').delete().eq('tenant_id', request.tenant_id);
    await loadRoomChangeRequests();
    toast.success('Room change approved!');
    return true;
  };

  const rejectRoomChange = async (requestId, reason) => {
    const cleanReason = reason?.trim();
    if (!cleanReason) { toast.error('Please provide a reason for rejection'); return false; }
    const { data, error } = await supabase
      .from('room_change_requests')
      .update({ status:'rejected', processed_at:new Date().toISOString(), rejection_reason:cleanReason })
      .eq('id', requestId)
      .eq('property_id', property.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (error || !data) { toast.error(error?.message || 'This request was already updated'); return false; }
    await loadRoomChangeRequests();
    toast.success('Room change request rejected.');
    return true;
  };

  useEffect(() => {
    if (property?.id && enabled) loadRoomChangeRequests();
  }, [property?.id, enabled]);
  useRealtimeRefresh(`owner-room-changes-live:${property?.id || 'waiting'}`, ['room_change_requests', 'tenants', 'rooms'], loadRoomChangeRequests, Boolean(property?.id && enabled));

  return { roomChangeRequests, approveRoomChange, rejectRoomChange };
}
