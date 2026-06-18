import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate, getSharingDetails } from '../lib/utils'
import toast from 'react-hot-toast'

export function useTenantDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [tenant, setTenant] = useState(null)
  const [room, setRoom] = useState(null)
  const [property, setProperty] = useState(null)
  const [owner, setOwner] = useState(null)
  const [roommates, setRoommates] = useState([])
  const [notices, setNotices] = useState([])
  const [complaints, setComplaints] = useState([])
  const [paymentHistory, setPaymentHistory] = useState([])
  const [existingVacateRequest, setExistingVacateRequest] = useState(null)
  const [roommateVacateAlert, setRoommateVacateAlert] = useState(null)
  const [showComplaintModal, setShowComplaintModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showVacateModal, setShowVacateModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [complaintForm, setComplaintForm] = useState({ title: '', description: '', priority: 'medium' })
  const [vacateForm, setVacateForm] = useState({ expected_date: '', reason: '', rating: 0, review: '' })
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [editProfile, setEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '' })
  const [ratingHover, setRatingHover] = useState(0)
  const [ownerUpiId, setOwnerUpiId] = useState('')
  const [ownerUpiPhone, setOwnerUpiPhone] = useState('')
  const [paymentScreenshot, setPaymentScreenshot] = useState(null)
  const [paymentTransactionId, setPaymentTransactionId] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [showScreenshotModal, setShowScreenshotModal] = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [showRoomChangeModal, setShowRoomChangeModal] = useState(false)
  const [availableRooms, setAvailableRooms] = useState([])
  const [selectedNewRoom, setSelectedNewRoom] = useState('')
  const [roomChangeReason, setRoomChangeReason] = useState('')
  const [pendingRoomChangeRequest, setPendingRoomChangeRequest] = useState(null)

  // ----- Helper functions -----
  const calculateNextDueDate = () => {
    if (!tenant) return null
    const joinDate = new Date(tenant.move_in_date)
    const today = new Date()
    let nextDue = new Date(today.getFullYear(), today.getMonth(), joinDate.getDate())
    if (today > nextDue) nextDue = new Date(today.getFullYear(), today.getMonth() + 1, joinDate.getDate())
    return nextDue
  }

  const getRentStatus = () => {
    if (!tenant) return { status: 'loading', message: '', daysUntilDue: null, dueDate: null }
    const nextDueDate = calculateNextDueDate()
    const today = new Date()
    const daysUntilDue = Math.ceil((nextDueDate - today) / (1000 * 60 * 60 * 24))
    const isPaidThisMonth = tenant.last_payment_date &&
      new Date(tenant.last_payment_date) >= new Date(today.getFullYear(), today.getMonth(), 1)

    if ((tenant.pending_amount > 0 && tenant.pending_amount >= tenant.rent_amount) || (!isPaidThisMonth && tenant.pending_amount > 0)) {
      if (daysUntilDue < 0) return { status: 'overdue', message: `Overdue by ${Math.abs(daysUntilDue)} days`, daysUntilDue, dueDate: nextDueDate, urgent: true }
      else if (daysUntilDue <= 5) return { status: 'due_soon', message: `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`, daysUntilDue, dueDate: nextDueDate, urgent: true }
      else return { status: 'pending', message: `Due on ${formatDate(nextDueDate)}`, daysUntilDue, dueDate: nextDueDate, urgent: false }
    } else if (tenant.pending_amount > 0 && tenant.pending_amount < tenant.rent_amount) {
      return { status: 'partial', message: `Partial paid. Due: ${formatCurrency(tenant.pending_amount)}`, daysUntilDue: null, dueDate: null, urgent: false }
    }
    return { status: 'paid', message: `Next due on ${formatDate(nextDueDate)}`, daysUntilDue, dueDate: nextDueDate, urgent: false }
  }

  const uploadFile = async (file, prefix) => {
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${file.name.split('.').pop()}`
    const { data, error } = await supabase.storage
      .from('tenant-documents')
      .upload(fileName, file, { cacheControl: '3600' })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('tenant-documents').getPublicUrl(fileName)
    return publicUrl
  }

  const initiateUPIPayment = (upiId, amount) => {
    const cleanUpi = upiId.trim()
    if (!cleanUpi) {
      toast.error('Owner UPI ID not available')
      return
    }
    const payee = encodeURIComponent(cleanUpi)
    const payeeName = encodeURIComponent('HostelSet Rent')
    const amt = encodeURIComponent(amount)
    const cu = encodeURIComponent('INR')
    const tr = encodeURIComponent(`RENT_${Date.now()}`)
    const tn = encodeURIComponent(`Rent payment for ${tenant?.name || 'tenant'}`)
    const upiUrl = `upi://pay?pa=${payee}&pn=${payeeName}&am=${amt}&cu=${cu}&tr=${tr}&tn=${tn}`
    window.location.href = upiUrl
    setTimeout(() => {
      if (document.hasFocus()) {
        navigator.clipboard.writeText(cleanUpi)
        toast.error('Unable to open UPI app. UPI ID copied to clipboard.', { duration: 5000 })
      }
    }, 2500)
  }

  const copyUpiId = (upiId) => {
    navigator.clipboard.writeText(upiId)
    toast.success('UPI ID copied!')
  }

  const copyUpiPhone = (phone) => {
    navigator.clipboard.writeText(phone)
    toast.success('UPI Phone Number copied!')
  }

  // ----- Data loading (optimized) -----
  const loadTenantData = useCallback(async (userId, isBackground = false) => {
    if (!isBackground) setLoading(true)
    else setIsRefreshing(true)

    try {
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*, rooms:room_id(*), property:property_id(*)')
        .eq('user_id', userId)
        .maybeSingle()
      if (tenantError) throw tenantError
      if (!tenantData) {
        toast.error('No tenant record found')
        router.push('/login')
        return
      }
      setTenant(tenantData)
      setRoom(tenantData.rooms)
      setProperty(tenantData.property)
      setPaymentAmount(tenantData.pending_amount || tenantData.rent_amount)
      setProfileForm({ name: tenantData.name || '', phone: tenantData.phone || '', email: tenantData.email || '' })

      if (tenantData.property?.owner_id) {
        const { data: settings } = await supabase
          .from('owner_settings')
          .select('upi_id, upi_phone')
          .eq('owner_id', tenantData.property.owner_id)
          .maybeSingle()
        if (settings) {
          setOwnerUpiId(settings.upi_id || '')
          setOwnerUpiPhone(settings.upi_phone || '')
        } else {
          setOwnerUpiId(tenantData.property?.owner_upi_id || '')
          setOwnerUpiPhone('')
        }
      } else {
        setOwnerUpiId(tenantData.property?.owner_upi_id || '')
        setOwnerUpiPhone('')
      }

      if (tenantData.property?.owner_id) {
        const { data: ownerData } = await supabase
          .from('users')
          .select('full_name, phone, email')
          .eq('id', tenantData.property.owner_id)
          .single()
        setOwner(ownerData)
      }

      let roommatesList = []
      if (tenantData.room_id) {
        const { data: roommatesData } = await supabase
          .from('tenants')
          .select('name, phone, email, move_in_date, id')
          .eq('room_id', tenantData.room_id)
          .neq('id', tenantData.id)
        roommatesList = roommatesData || []
        setRoommates(roommatesList)
        if (roommatesList.length > 0) {
          const roommateIds = roommatesList.map(r => r.id)
          const { data: vacateRequests } = await supabase
            .from('check_out_requests')
            .select('tenant_id, tenant_name, expected_check_out')
            .in('tenant_id', roommateIds)
            .eq('status', 'approved')
          if (vacateRequests && vacateRequests.length > 0) {
            const upcoming = vacateRequests.find(v => new Date(v.expected_check_out) > new Date())
            if (upcoming) {
              const roommate = roommatesList.find(r => r.id === upcoming.tenant_id)
              const daysLeft = Math.ceil((new Date(upcoming.expected_check_out) - new Date()) / (1000 * 60 * 60 * 24))
              setRoommateVacateAlert({ name: roommate?.name || upcoming.tenant_name, daysLeft, date: upcoming.expected_check_out })
            }
          }
        }
      }

      const { data: vacateData } = await supabase
        .from('check_out_requests')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .in('status', ['pending', 'approved'])
        .maybeSingle()
      setExistingVacateRequest(vacateData)

      const { data: noticesData } = await supabase
        .from('notices')
        .select('*')
        .eq('property_id', tenantData.property_id)
        .order('created_at', { ascending: false })
        .limit(10)
      setNotices(noticesData || [])

      const { data: complaintsData } = await supabase
        .from('complaints')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .order('created_at', { ascending: false })
      setComplaints(complaintsData || [])

      const { data: paymentsData } = await supabase
        .from('payment_history')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .order('payment_date', { ascending: false })
      setPaymentHistory(paymentsData || [])

      const { data: pendingChange } = await supabase
        .from('room_change_requests')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .eq('status', 'pending')
        .maybeSingle()
      setPendingRoomChangeRequest(pendingChange)

      const rentStatus = getRentStatus()
      const lastAlertDate = localStorage.getItem('lastTenantAlertDate')
      const today = new Date().toDateString()
      if (lastAlertDate !== today) {
        if (rentStatus.status === 'due_soon' && rentStatus.daysUntilDue <= 3 && rentStatus.daysUntilDue > 0) {
          toast(`📢 Rent ${rentStatus.message}!`, { duration: 5000 })
        } else if (rentStatus.status === 'overdue') {
          toast.error(`⚠️ Rent ${rentStatus.message}! Please pay at earliest.`, { duration: 5000 })
        }
        localStorage.setItem('lastTenantAlertDate', today)
      }
    } catch (error) {
      console.error('Load tenant data error:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      if (!isBackground) setLoading(false)
      else setIsRefreshing(false)
    }
  }, [])

  const refreshData = useCallback((isBackground = true) => {
    const userId = localStorage.getItem('userId')
    if (userId) loadTenantData(userId, isBackground)
  }, [loadTenantData])

  // ----- Handlers -----
  const updateProfile = async () => {
    if (isSubmitting) return
    if (!profileForm.name) { toast.error('Name is required'); return }
    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ name: profileForm.name, phone: profileForm.phone, email: profileForm.email })
        .eq('id', tenant.id)
      if (error) throw error
      toast.success('Profile updated successfully!')
      setEditProfile(false)
      await refreshData(true)
    } catch (error) {
      toast.error('Failed to update profile')
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitComplaint = async () => {
    if (isSubmitting) return
    if (!complaintForm.title || !complaintForm.description) { toast.error('Please fill all fields'); return }
    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('complaints')
        .insert({
          tenant_id: tenant.id,
          property_id: tenant.property_id,
          room_id: tenant.room_id,
          tenant_name: tenant.name,
          room_number: room?.room_number,
          title: complaintForm.title,
          description: complaintForm.description,
          priority: complaintForm.priority,
          status: 'open',
          created_at: new Date().toISOString()
        })
      if (error) throw error
      toast.success('Complaint submitted successfully!')
      setShowComplaintModal(false)
      setComplaintForm({ title: '', description: '', priority: 'medium' })
      await refreshData(true)
    } catch (error) {
      console.error('Submit complaint error:', error)
      toast.error('Failed to submit complaint: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ==========================================================================
  // FIXED: deleteComplaint – always sync with database after attempt
  // ==========================================================================
  const deleteComplaint = async (complaintId) => {
    if (isSubmitting) return
    if (!confirm('Delete this complaint? This action cannot be undone.')) return
    setIsSubmitting(true)
    try {
      console.log('Deleting complaint ID:', complaintId)
      const { data, error } = await supabase
        .from('complaints')
        .delete()
        .eq('id', complaintId)
        .eq('tenant_id', tenant.id)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        toast.error('Complaint not found or already deleted.')
        await refreshData(true)
        return
      }
      toast.success('Complaint deleted.')
      // Update local state immediately
      setComplaints(prev => prev.filter(c => c.id !== complaintId))
      // Refresh in background to ensure consistency
      await refreshData(true)
    } catch (error) {
      console.error('Delete complaint error:', error)
      toast.error('Failed to delete complaint: ' + error.message)
      await refreshData(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const requestVacate = async () => {
    if (isSubmitting) return
    if (!vacateForm.expected_date) { toast.error('Please select expected check-out date'); return }
    if (vacateForm.rating === 0) { toast.error('Please rate your experience (1-5 stars) before submitting vacate request'); return }
    setIsSubmitting(true)
    try {
      const vacateData = {
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        property_id: tenant.property_id,
        room_id: tenant.room_id,
        room_number: room?.room_number || 'N/A',
        expected_check_out: vacateForm.expected_date,
        reason: vacateForm.reason || null,
        requested_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        created_at: new Date().toISOString()
      }
      const { error } = await supabase.from('check_out_requests').insert(vacateData)
      if (error) throw new Error(error.message)
      const { error: ratingError } = await supabase
        .from('ratings')
        .insert({
          tenant_id: tenant.id,
          property_id: tenant.property_id,
          rating: vacateForm.rating,
          review: vacateForm.review || null,
          created_at: new Date().toISOString()
        })
      if (ratingError) console.error('Rating submit error:', ratingError)
      toast.success('Vacate request submitted! Owner will review it.')
      setShowVacateModal(false)
      setVacateForm({ expected_date: '', reason: '', rating: 0, review: '' })
      await refreshData(true)
    } catch (error) {
      console.error('Vacate request error:', error)
      toast.error('Failed to submit vacate request: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const cancelVacateRequest = async () => {
    if (isSubmitting) return
    if (!existingVacateRequest) return
    const { data: preBooking } = await supabase
      .from('pre_bookings')
      .select('id')
      .eq('room_id', tenant.room_id)
      .eq('status', 'approved')
      .maybeSingle()
    if (preBooking) {
      toast.error('Cannot cancel vacate – a pre‑booking has already been approved for this room.')
      return
    }
    if (!confirm('Cancel your vacate request? You will continue as a tenant.')) return
    setIsSubmitting(true)
    try {
      await supabase.from('check_out_requests').delete().eq('id', existingVacateRequest.id)
      await supabase.from('tenants').update({ status: 'active', check_out_requested: false, notice_period_start: null, notice_period_end: null }).eq('id', tenant.id)
      toast.success('Vacate request cancelled. You remain as an active tenant.')
      await refreshData(true)
    } catch (error) {
      toast.error('Failed to cancel request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitPaymentWithProof = async () => {
    if (isSubmitting) return
    if (!paymentScreenshot) { toast.error('Please upload payment screenshot'); return }
    setPaymentLoading(true)
    setIsSubmitting(true)
    try {
      const screenshotUrl = await uploadFile(paymentScreenshot, 'rent')
      const amount = tenant.pending_amount || tenant.rent_amount
      const { error: paymentError } = await supabase.from('payment_history').insert({
        tenant_id: tenant.id,
        amount: amount,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'upi',
        status: 'payment_pending',
        payment_screenshot: screenshotUrl,
        upi_transaction_id: paymentTransactionId || null
      })
      if (paymentError) throw paymentError
      toast.success('Payment proof submitted! Waiting for owner confirmation.')
      setShowPaymentModal(false)
      setPaymentScreenshot(null)
      setPaymentTransactionId('')
      await refreshData(true)
    } catch (error) {
      console.error('Payment error:', error)
      toast.error('Failed to submit payment: ' + error.message)
    } finally {
      setPaymentLoading(false)
      setIsSubmitting(false)
    }
  }

  const fetchAvailableRooms = async () => {
    try {
      const { data: allRooms, error } = await supabase
        .from('rooms')
        .select('id, room_number, sharing_type, monthly_rent, capacity, current_occupants')
        .eq('property_id', tenant.property_id)
        .neq('id', tenant.room_id)
      if (error) throw error

      const { data: pendingChanges } = await supabase
        .from('room_change_requests')
        .select('new_room_id')
        .eq('property_id', tenant.property_id)
        .eq('status', 'pending')
      const pendingRoomIds = pendingChanges?.map(p => p.new_room_id) || []

      const available = allRooms.filter(room => 
        room.current_occupants < room.capacity && 
        !pendingRoomIds.includes(room.id)
      )
      setAvailableRooms(available)
    } catch (error) {
      console.error('Fetch available rooms error:', error)
      toast.error('Failed to load available rooms')
    }
  }

  const openRoomChangeModal = () => {
    fetchAvailableRooms()
    setSelectedNewRoom('')
    setRoomChangeReason('')
    setShowRoomChangeModal(true)
  }

  // ==========================================================================
  // FIXED: submitRoomChangeRequest – selects room correctly
  // ==========================================================================
  const submitRoomChangeRequest = async () => {
    if (isSubmitting) return
    if (!selectedNewRoom) { toast.error('Please select a room'); return }
    if (pendingRoomChangeRequest) { toast.error('You already have a pending room change request'); return }
    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('room_change_requests')
        .insert({
          tenant_id: tenant.id,
          property_id: tenant.property_id,
          old_room_id: tenant.room_id,
          new_room_id: selectedNewRoom,
          reason: roomChangeReason || null,
          status: 'pending',
          requested_at: new Date().toISOString()
        })
      if (error) throw error
      toast.success('Room change request submitted! Owner will review it.')
      setShowRoomChangeModal(false)
      // Clear selected room after submit
      setSelectedNewRoom('')
      setRoomChangeReason('')
      await refreshData(true)
    } catch (error) {
      console.error('Room change request error:', error)
      toast.error('Failed to submit request: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ----- Auth check -----
  const checkAuthAndRedirect = async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      localStorage.clear()
      router.push('/login')
      return null
    }
    const { data: userRecord, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    if (roleError || !userRecord) {
      localStorage.clear()
      router.push('/login')
      return null
    }
    return { user, role: userRecord.role }
  }

  // ----- Initial useEffect -----
  useEffect(() => {
    const init = async () => {
      const auth = await checkAuthAndRedirect()
      if (!auth) return
      if (auth.role !== 'tenant') {
        router.push('/login')
        return
      }
      localStorage.setItem('userId', auth.user.id)
      await loadTenantData(auth.user.id, false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.clear()
        router.push('/login')
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Session refreshed')
      }
    })

    const handleBeforeUnload = (e) => {
      if (localStorage.getItem('userId')) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    const handleRouteChange = (url) => {
      if (localStorage.getItem('userId') && !confirm('You will lose any unsaved data. Do you want to leave the dashboard?')) {
        throw 'Route change cancelled'
      }
    }
    router.events?.on('routeChangeStart', handleRouteChange)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      router.events?.off('routeChangeStart', handleRouteChange)
    }
  }, [])

  // ==========================================================================
  // REAL‑TIME SUBSCRIPTIONS
  // ==========================================================================
  useEffect(() => {
    if (!tenant?.id) return

    const channelPayments = supabase
      .channel('payments-tenant')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_history', filter: `tenant_id=eq.${tenant.id}` },
        () => { console.log('💰 Payment updated'); refreshData(true) }
      )
      .subscribe()

    const channelComplaints = supabase
      .channel('complaints-tenant')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints', filter: `tenant_id=eq.${tenant.id}` },
        () => { console.log('🔧 Complaint updated'); refreshData(true) }
      )
      .subscribe()

    const channelNotices = supabase
      .channel('notices-tenant')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notices', filter: `property_id=eq.${tenant.property_id}` },
        () => { console.log('📢 Notice posted'); refreshData(true) }
      )
      .subscribe()

    const channelVacate = supabase
      .channel('vacate-tenant')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'check_out_requests', filter: `tenant_id=eq.${tenant.id}` },
        () => { console.log('🚪 Vacate changed'); refreshData(true) }
      )
      .subscribe()

    const channelRoomChange = supabase
      .channel('roomchange-tenant')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_change_requests', filter: `tenant_id=eq.${tenant.id}` },
        () => { console.log('🔄 Room change changed'); refreshData(true) }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channelPayments)
      supabase.removeChannel(channelComplaints)
      supabase.removeChannel(channelNotices)
      supabase.removeChannel(channelVacate)
      supabase.removeChannel(channelRoomChange)
    }
  }, [tenant?.id])

  // ==========================================================================
  // RETURN
  // ==========================================================================
  return {
    loading,
    isRefreshing,
    tenant,
    room,
    property,
    owner,
    roommates,
    notices,
    complaints,
    paymentHistory,
    existingVacateRequest,
    roommateVacateAlert,
    showComplaintModal,
    setShowComplaintModal,
    showPaymentModal,
    setShowPaymentModal,
    showVacateModal,
    setShowVacateModal,
    showProfileModal,
    setShowProfileModal,
    complaintForm,
    setComplaintForm,
    vacateForm,
    setVacateForm,
    paymentAmount,
    setPaymentAmount,
    isSubmitting,
    activeTab,
    setActiveTab,
    editProfile,
    setEditProfile,
    profileForm,
    setProfileForm,
    ratingHover,
    setRatingHover,
    ownerUpiId,
    ownerUpiPhone,
    paymentScreenshot,
    setPaymentScreenshot,
    paymentTransactionId,
    setPaymentTransactionId,
    paymentLoading,
    showScreenshotModal,
    setShowScreenshotModal,
    screenshotUrl,
    setScreenshotUrl,
    showRoomChangeModal,
    setShowRoomChangeModal,
    availableRooms,
    selectedNewRoom,
    setSelectedNewRoom,
    roomChangeReason,
    setRoomChangeReason,
    pendingRoomChangeRequest,
    calculateNextDueDate,
    getRentStatus,
    initiateUPIPayment,
    copyUpiId,
    copyUpiPhone,
    refreshData,
    updateProfile,
    submitComplaint,
    deleteComplaint,
    requestVacate,
    cancelVacateRequest,
    submitPaymentWithProof,
    openRoomChangeModal,
    submitRoomChangeRequest,
    handleLogout: async () => {
      await supabase.auth.signOut()
      localStorage.clear()
      router.push('/')
    }
  }
}
