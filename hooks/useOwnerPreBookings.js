import { useState, useEffect } from 'react'
import { supabase, signPrivateDocumentFields } from '../lib/supabase'
import toast from 'react-hot-toast'
import { useRealtimeRefresh } from './useRealtimeRefresh'

export function useOwnerPreBookings(property, enabled = true) {
  const [preBookings, setPreBookings] = useState([])
  const [processingId, setProcessingId] = useState(null)

  const loadPreBookings = async () => {
    if (!property?.id) return
    const { data, error } = await supabase.from('pre_bookings')
      .select('*, rooms(room_number, monthly_rent, capacity)')
      .eq('property_id', property.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load pre-bookings')
    else setPreBookings(await Promise.all((data || []).map(item => signPrivateDocumentFields(item, ['id_proof', 'photo', 'payment_screenshot']))))
  }

  const approvePreBooking = async (bookingId) => {
    if (processingId) return
    if (!confirm('Approve this pre-booking? The user will become a tenant.')) return
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
      toast.success(result.emailSent ? 'Pre-booking approved and password email sent.' : 'Pre-booking approved; password email needs resending.')
      await loadPreBookings()
    } catch (error) {
      console.error('Approve pre-booking error:', error)
      toast.error('Failed to approve pre-booking: ' + error.message)
    } finally { setProcessingId(null) }
  }

  const rejectPreBooking = async (bookingId) => {
    if (!confirm('Reject this pre-booking?')) return
    const { error } = await supabase.from('pre_bookings')
      .update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', bookingId)
    if (error) toast.error('Failed to reject pre-booking')
    else { toast.success('Pre-booking rejected.'); await loadPreBookings() }
  }

  useEffect(() => { setPreBookings([]); if (property?.id && enabled) loadPreBookings() }, [property?.id, enabled])
  useRealtimeRefresh(`owner-prebookings-live:${property?.id || 'waiting'}`, ['pre_bookings', 'rooms'], loadPreBookings, Boolean(property?.id && enabled))

  return { preBookings, approvePreBooking, rejectPreBooking, processingId }
}
