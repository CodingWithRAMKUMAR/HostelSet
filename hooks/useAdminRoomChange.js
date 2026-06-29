import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useAdminRoomChange(enabled = true) {
  const [roomChanges, setRoomChanges] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRoomChanges = async (background = false) => {
    if (!background) setLoading(true);
    const { data, error } = await supabase.from('room_change_requests')
      .select('*, tenants(name, phone), old_room:old_room_id(room_number), new_room:new_room_id(room_number)')
      .order('requested_at', { ascending: false });
    if (error) toast.error('Failed to load room changes');
    else setRoomChanges(data || []);
    setLoading(false);
  };

  const approveRoomChange = async (requestId, tenantId, newRoomId, oldRoomId) => {
    const { error } = await supabase.rpc('move_tenant_room', { p_tenant_id: tenantId, p_new_room_id: newRoomId, p_old_room_id: oldRoomId });
    if (error) toast.error('Failed to approve room change');
    else { await supabase.from('room_change_requests').update({ status: 'approved', processed_at: new Date().toISOString() }).eq('id', requestId); toast.success('Room change approved.'); await loadRoomChanges(); }
  };

  const rejectRoomChange = async (requestId) => {
    if (!confirm('Reject this room change request?')) return;
    const { error } = await supabase.from('room_change_requests').update({ status: 'rejected', processed_at: new Date().toISOString() }).eq('id', requestId);
    if (error) toast.error('Failed to reject room change');
    else { toast.success('Room change rejected.'); await loadRoomChanges(); }
  };

  useEffect(() => { if (enabled) loadRoomChanges(); }, [enabled]);
  useRealtimeRefresh('admin-room-changes-live', ['room_change_requests', 'tenants', 'rooms'], loadRoomChanges, enabled);
  return { roomChanges, loading, approveRoomChange, rejectRoomChange, refreshRoomChanges: loadRoomChanges };
}
