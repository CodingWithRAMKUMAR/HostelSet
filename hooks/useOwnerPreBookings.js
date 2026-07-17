import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export function useOwnerPreBookings(property, enabled = true) {
  const [preBookings, setPreBookings] = useState([])
  const [processingId, setProcessingId] = useState(null)
  const refreshTimer = useRef()

  const loadPreBookings = useCallback(async () => {
    if (!property?.id) return
    const { data, error } = await supabase.from('pre_bookings')
      .select('*, rooms(room_number, monthly_rent, capacity, current_occupants, has_approved_prebooking)')
      .eq('property_id', property.id)
      .in('status', ['pending', 'reserved', 'converted'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load pre-bookings')
    else setPreBookings(data || [])
  }, [property?.id])

  const approvePreBooking = async (bookingId) => {
    if (processingId) return
    if (!confirm('Reserve this room for the applicant? No tenant account will be created until the current bed is vacated.')) return
    try {
      setProcessingId(bookingId)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your session expired. Please log in again.')
      const response = await fetch('/api/requests/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ type: 'prebooking', id: bookingId }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Approval failed')
      toast.success(result.reservationEmailSent ? 'Pre-booking reserved and confirmation email sent.' : 'Pre-booking reserved.')
      await loadPreBookings()
    } catch (error) {
      console.error('Approve pre-booking error:', error)
      toast.error('Failed to approve pre-booking: ' + error.message)
    } finally { setProcessingId(null) }
  }

  const rejectPreBooking = async (bookingId) => {
    if (!confirm('Reject this pre-booking?')) return
    const { error } = await supabase.rpc('reject_prebooking', { p_booking_id: bookingId, p_reason: null })
    if (error) toast.error('Failed to reject pre-booking')
    else { toast.success('Pre-booking rejected.'); await loadPreBookings() }
  }

  const convertReservedPreBooking = async (bookingId) => {
    if (processingId) return
    if (!confirm('Convert this reserved pre-booking now? This is only allowed after the room has an actual vacancy.')) return
    try {
      setProcessingId(bookingId)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your session expired. Please log in again.')
      const response = await fetch('/api/requests/convert-reserved-prebooking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ bookingId }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Conversion failed')
      toast.success(result.setupEmailSent ? 'Reserved pre-booking converted and setup email sent.' : 'Reserved pre-booking is already converted.')
      await loadPreBookings()
    } catch (error) {
      toast.error('Failed to convert pre-booking: ' + error.message)
    } finally { setProcessingId(null) }
  }

  useEffect(() => { setPreBookings([]); if (property?.id && enabled) loadPreBookings() }, [property?.id, enabled, loadPreBookings])
  useEffect(() => {
    if (!property?.id || !enabled) return undefined
    const channel = supabase
      .channel(`owner-prebookings:${property.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pre_bookings', filter: `property_id=eq.${property.id}` }, () => {
        clearTimeout(refreshTimer.current)
        refreshTimer.current = setTimeout(loadPreBookings, 150)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `property_id=eq.${property.id}` }, () => {
        clearTimeout(refreshTimer.current)
        refreshTimer.current = setTimeout(loadPreBookings, 150)
      })
      .subscribe()
    return () => { clearTimeout(refreshTimer.current); supabase.removeChannel(channel) }
  }, [property?.id, enabled, loadPreBookings])

  return { preBookings, approvePreBooking, rejectPreBooking, convertReservedPreBooking, processingId }
}
