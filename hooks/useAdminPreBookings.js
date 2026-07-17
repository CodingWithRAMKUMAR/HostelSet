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
      .select('*, rooms(room_number, monthly_rent, capacity, current_occupants, has_approved_prebooking, property_id, properties(name))')
      .in('status', ['pending', 'reserved', 'converted'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load pre-bookings');
    else setPreBookings(data || []);
    setLoading(false);
  };

  const approvePreBooking = async (bookingId, userId, roomId, propertyId, name, phone, email, monthlyRent) => {
    if (!confirm('Reserve this room for the applicant? No tenant account will be created until the current bed is vacated.')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Please log in again.');
      const response = await fetch('/api/requests/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: 'prebooking', id: bookingId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Approval failed');
      toast.success(result.reservationEmailSent ? 'Pre-booking reserved and confirmation email sent.' : 'Pre-booking reserved.');
      await loadPreBookings();
    } catch (error) {
      toast.error('Failed to approve pre-booking: ' + error.message);
    }
  };

  const rejectPreBooking = async (bookingId) => {
    if (!confirm('Reject this pre-booking?')) return;
    const { error } = await supabase.rpc('reject_prebooking', { p_booking_id: bookingId, p_reason: null });
    if (error) toast.error('Failed to reject pre-booking');
    else { toast.success('Pre-booking rejected.'); await loadPreBookings(); }
  };

  useEffect(() => { if (enabled) loadPreBookings(); }, [enabled]);
  useRealtimeRefresh('admin-prebookings-live', ['pre_bookings', 'rooms', 'properties'], loadPreBookings, enabled);
  return { preBookings, loading, approvePreBooking, rejectPreBooking, refreshPreBookings: loadPreBookings };
}
