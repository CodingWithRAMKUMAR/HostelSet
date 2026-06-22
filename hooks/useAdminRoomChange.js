import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useAdminRoomChange() {
  const [roomChanges, setRoomChanges] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRoomChanges = async () => {
    setLoading(true);
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

  useEffect(() => {
    loadRoomChanges();
    const channel = supabase.channel('admin-roomchange')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_change_requests' }, (payload) => {
        if (payload.eventType === 'INSERT') setRoomChanges(prev => [payload.new, ...prev]);
        else if (payload.eventType === 'UPDATE') setRoomChanges(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
        else if (payload.eventType === 'DELETE') setRoomChanges(prev => prev.filter(r => r.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
  return { roomChanges, loading, approveRoomChange, rejectRoomChange, refreshRoomChanges: loadRoomChanges };
}
