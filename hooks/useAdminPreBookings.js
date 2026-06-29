import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useAdminPreBookings(enabled = true) {
  const [preBookings, setPreBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPreBookings = async (background = false) => {
    if (!background) setLoading(true);
    const { data, error } = await supabase
      .from('pre_bookings')
      .select('*, rooms(room_number, monthly_rent, capacity, property_id, properties(name))')
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load pre-bookings');
    else setPreBookings(data || []);
    setLoading(false);
  };

  const approvePreBooking = async (bookingId, userId, roomId, propertyId, name, phone, email, monthlyRent) => {
    if (!confirm('Approve this pre-booking? The user will be converted to a tenant.')) return;
    const moveInDate = new Date(); moveInDate.setDate(moveInDate.getDate() + 7);
    const { error: tenantError } = await supabase.from('tenants').insert({
      user_id: userId, property_id: propertyId, room_id: roomId, name, phone, email,
      rent_amount: monthlyRent, pending_amount: monthlyRent, total_paid: 0,
      rent_status: 'pending', move_in_date: moveInDate.toISOString().split('T')[0], status: 'active'
    });
    if (tenantError) { toast.error('Failed to create tenant: ' + tenantError.message); return; }
    const { data: room, error: roomError } = await supabase.from('rooms').select('current_occupants, capacity').eq('id', roomId).single();
    if (roomError) { toast.error('Tenant created, but room could not be updated: ' + roomError.message); return; }
    const occupants = Number(room.current_occupants || 0) + 1;
    if (occupants > room.capacity) { toast.error('The room is already full.'); return; }
    const { error: updateRoomError } = await supabase.from('rooms').update({ current_occupants: occupants, status: occupants >= room.capacity ? 'occupied' : 'vacant' }).eq('id', roomId);
    if (updateRoomError) { toast.error('Tenant created, but room could not be updated: ' + updateRoomError.message); return; }
    const { error: bookingError } = await supabase.from('pre_bookings').delete().eq('id', bookingId);
    if (bookingError) { toast.error('Tenant created, but booking cleanup failed: ' + bookingError.message); return; }
    toast.success('Pre-booking approved! Tenant created.');
    await loadPreBookings();
  };

  const rejectPreBooking = async (bookingId) => {
    if (!confirm('Reject this pre-booking?')) return;
    const { error } = await supabase.from('pre_bookings').update({ status: 'rejected' }).eq('id', bookingId);
    if (error) toast.error('Failed to reject pre-booking');
    else { toast.success('Pre-booking rejected.'); await loadPreBookings(); }
  };

  useEffect(() => { if (enabled) loadPreBookings(); }, [enabled]);
  useRealtimeRefresh('admin-prebookings-live', ['pre_bookings', 'rooms', 'properties'], loadPreBookings, enabled);
  return { preBookings, loading, approvePreBooking, rejectPreBooking, refreshPreBookings: loadPreBookings };
}
