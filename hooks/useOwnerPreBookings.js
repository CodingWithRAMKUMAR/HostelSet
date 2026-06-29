import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useOwnerPreBookings(property) {
  const [preBookings, setPreBookings] = useState([]);

  const loadPreBookings = async () => {
    if (!property?.id) return;
    const { data } = await supabase
      .from('pre_bookings')
      .select('*, rooms(room_number, monthly_rent, capacity)')
      .eq('property_id', property.id)
      .order('created_at', { ascending: false });
    setPreBookings(data || []);
  };

  const approvePreBooking = async (bookingId, bookingData) => {
    if (!confirm('Approve this pre‑booking? The user will become a tenant.')) return;
    try {
      const moveInDate = new Date(); moveInDate.setDate(moveInDate.getDate() + 7);
      const totalPaid = bookingData.pre_booking_fee_amount || 0;
      const monthlyRent = bookingData.rooms?.monthly_rent || 0;
      const pendingAmount = monthlyRent - totalPaid;

      const { data: newTenant, error: tenantError } = await supabase.from('tenants').insert({
        user_id: bookingData.user_id,
        property_id: bookingData.property_id,
        room_id: bookingData.room_id,
        name: bookingData.name,
        phone: bookingData.phone,
        email: bookingData.email,
        rent_amount: monthlyRent,
        pending_amount: pendingAmount > 0 ? pendingAmount : 0,
        total_paid: totalPaid,
        rent_status: pendingAmount <= 0 ? 'paid' : 'pending',
        move_in_date: moveInDate.toISOString().split('T')[0],
        status: 'active'
      }).select().single();
      if (tenantError) throw tenantError;

      if (totalPaid > 0 && newTenant) {
        await supabase.from('payment_history').insert({
          tenant_id: newTenant.id,
          amount: totalPaid,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'pre_booking',
          status: 'success'
        });
      }

      const { data: roomData } = await supabase.from('rooms').select('current_occupants, capacity').eq('id', bookingData.room_id).single();
      const newOccupants = (roomData.current_occupants || 0) + 1;
      const newStatus = newOccupants >= roomData.capacity ? 'occupied' : 'vacant';
      await supabase.from('rooms').update({ current_occupants: newOccupants, status: newStatus }).eq('id', bookingData.room_id);

      await supabase.from('pre_bookings').delete().eq('id', bookingId);
      toast.success('Pre‑booking approved! Tenant created.');
      await loadPreBookings();
    } catch (error) {
      console.error('Approve pre-booking error:', error);
      toast.error('Failed to approve pre‑booking: ' + error.message);
    }
  };

  const rejectPreBooking = async (bookingId) => {
    if (!confirm('Reject this pre‑booking?')) return;
    const { error } = await supabase.from('pre_bookings').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', bookingId);
    if (error) toast.error('Failed to reject pre‑booking');
    else { toast.success('Pre‑booking rejected.'); await loadPreBookings(); }
  };

  useEffect(() => {
    if (property?.id) loadPreBookings();
  }, [property?.id]);
  useRealtimeRefresh(`owner-prebookings-live:${property?.id || 'waiting'}`, ['pre_bookings', 'rooms'], loadPreBookings, Boolean(property?.id));

  return { preBookings, approvePreBooking, rejectPreBooking };
}
