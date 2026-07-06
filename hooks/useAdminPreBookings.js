import { useState, useEffect } from 'react';
import { supabase, signPrivateDocumentFields } from '../lib/supabase';
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
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load pre-bookings');
    else setPreBookings(await Promise.all((data || []).map(item => signPrivateDocumentFields(item, ['id_proof', 'photo', 'payment_screenshot']))));
    setLoading(false);
  };

  const approvePreBooking = async (bookingId, userId, roomId, propertyId, name, phone, email, monthlyRent) => {
    if (!confirm('Approve this pre-booking? The user will be converted to a tenant.')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Please log in again.');
      const response = await fetch('/api/requests/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: 'prebooking', id: bookingId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Approval failed');
      toast.success(result.emailSent ? 'Pre-booking approved and password email sent.' : 'Pre-booking approved; password email needs resending.');
      await loadPreBookings();
    } catch (error) {
      toast.error('Failed to approve pre-booking: ' + error.message);
    }
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
