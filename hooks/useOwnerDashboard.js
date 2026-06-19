import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate, getSharingDetails, cleanPhoneNumber, calculateRentDueStatus } from '../lib/utils'
import toast from 'react-hot-toast'

export function useOwnerDashboard() {
  const router = useRouter()
  // ----- State (unchanged) -----
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [property, setProperty] = useState(null)
  const [rooms, setRooms] = useState([])
  const [tenants, setTenants] = useState([])
  const [applications, setApplications] = useState([])
  const [vacateRequests, setVacateRequests] = useState([])
  const [complaints, setComplaints] = useState([])
  const [notices, setNotices] = useState([])
  const [propertyImages, setPropertyImages] = useState([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showNoticeModal, setShowNoticeModal] = useState(false)
  const [showRoomDetailsModal, setShowRoomDetailsModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [selectedComplaint, setSelectedComplaint] = useState(null)
  const [showComplaintResponseModal, setShowComplaintResponseModal] = useState(false)
  const [complaintResponse, setComplaintResponse] = useState('')
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', rent_amount: '', room_id: '', advance_amount: '0', joining_fee: '0'
  })
  const [roomForm, setRoomForm] = useState({ room_number: '', sharing_type: 'double', monthly_rent: 10000 })
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', type: 'general', is_urgent: false })
  const [paymentAmount, setPaymentAmount] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [settings, setSettings] = useState({ joining_fee: 0, advance_months: 1, due_day: 5, upi_id: '', upi_phone: '' })
  const [stats, setStats] = useState({
    totalRooms: 0, occupied: 0, vacant: 0, totalCollected: 0, pendingAmount: 0,
    totalComplaints: 0, pendingVacate: 0, overdueCount: 0, noticePeriodCount: 0,
    pendingPaymentCount: 0, pendingRentConfirmations: 0, monthlyIncome: 0
  })
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false)
  const [tenantToDelete, setTenantToDelete] = useState(null)
  const [showMembershipModal, setShowMembershipModal] = useState(false)
  const [membershipActive, setMembershipActive] = useState(false)
  const [membershipLoading, setMembershipLoading] = useState(false)
  const [membershipStatus, setMembershipStatus] = useState('loading')
  const autoRefreshRef = useRef(null)
  const refreshTimeoutRef = useRef(null)

  const [membershipExpiry, setMembershipExpiry] = useState(null)
  const [daysLeft, setDaysLeft] = useState(null)

  const [preBookings, setPreBookings] = useState([])

  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false)
  const [confirmingTenant, setConfirmingTenant] = useState(null)

  const [pendingRentPayments, setPendingRentPayments] = useState([])
  const [allPayments, setAllPayments] = useState([])
  const [roomMonthlyIncome, setRoomMonthlyIncome] = useState({})

  const [selectedApplication, setSelectedApplication] = useState(null)
  const [showApplicationDetailModal, setShowApplicationDetailModal] = useState(false)

  const [showTenantPaymentsModal, setShowTenantPaymentsModal] = useState(false)
  const [selectedTenantForPayments, setSelectedTenantForPayments] = useState(null)
  const [tenantPayments, setTenantPayments] = useState([])

  const [showScreenshotModal, setShowScreenshotModal] = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState('')

  const [searchTerm, setSearchTerm] = useState('')

  const [showTenantProfileModal, setShowTenantProfileModal] = useState(false)
  const [selectedProfileTenant, setSelectedProfileTenant] = useState(null)
  const [tenantApplication, setTenantApplication] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)

  const [roomChangeRequests, setRoomChangeRequests] = useState([])
  const [showRoomChangeReasonModal, setShowRoomChangeReasonModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [selectedRoomChangeRequest, setSelectedRoomChangeRequest] = useState(null)

  const [alerts, setAlerts] = useState([])
  const alertTimeoutRef = useRef({})

  const previousDataRef = useRef({
    vacateRequests: [],
    pendingRentPayments: [],
    complaints: [],
    preBookings: [],
    roomChangeRequests: []
  })

  const sharingTypes = [
    { value: 'single', label: 'Single Sharing', capacity: 1, icon: '👤', price: 15000 },
    { value: 'double', label: 'Double Sharing', capacity: 2, icon: '👥', price: 10000 },
    { value: 'triple', label: 'Triple Sharing', capacity: 3, icon: '👥👤', price: 8000 },
    { value: 'four', label: 'Four Sharing', capacity: 4, icon: '👥👥', price: 7000 },
    { value: 'five', label: 'Five Sharing', capacity: 5, icon: '👥👥👤', price: 6000 },
  ]

  // ----- Helper functions (unchanged) -----
  const getRoomNumberById = (roomId) => {
    if (!rooms || !Array.isArray(rooms)) return 'N/A'
    const room = rooms.find(r => r.id === roomId)
    return room ? room.room_number : 'N/A'
  }

  const getTenantsInRoom = (roomId) => {
    if (!tenants || !Array.isArray(tenants)) return []
    return tenants.filter(t => t.room_id === roomId)
  }

  const getUpcomingVacateForRoom = (roomId) => {
    const vacate = vacateRequests.find(v => v.room_id === roomId && v.status === 'approved')
    if (!vacate) return null
    const tenant = tenants.find(t => t.id === vacate.tenant_id)
    if (!tenant || tenant.room_id !== vacate.room_id) return null
    const vacateDate = new Date(vacate.expected_check_out)
    const today = new Date()
    const daysLeft = Math.ceil((vacateDate - today) / (1000 * 60 * 60 * 24))
    if (daysLeft < 0) return { date: vacate.expected_check_out, daysLeft: 0, overdue: true }
    return { date: vacate.expected_check_out, daysLeft, overdue: false }
  }

  // ----- Alert functions (unchanged) -----
  const addAlert = (message, type, linkTab, linkId = null) => {
    const id = Date.now() + Math.random()
    const newAlert = { id, message, type, linkTab, linkId, createdAt: Date.now() }
    setAlerts(prev => [newAlert, ...prev])
    alertTimeoutRef.current[id] = setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== id))
      delete alertTimeoutRef.current[id]
    }, 30000)
  }

  const removeAlert = (id) => {
    if (alertTimeoutRef.current[id]) clearTimeout(alertTimeoutRef.current[id])
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  const handleAlertClick = (alert) => {
    if (alert.linkTab) setActiveTab(alert.linkTab)
    removeAlert(alert.id)
  }

  const clearAlertForItem = (type, itemId) => {
    setAlerts(prev => prev.filter(a => !(a.type === type && a.linkId === itemId)))
  }

  const cleanStaleAlerts = (currentVacateRequests, currentPreBookings, currentRoomChangeRequests) => {
    setAlerts(prev => {
      return prev.filter(alert => {
        if (alert.type === 'vacate') {
          const req = currentVacateRequests.find(v => v.id === alert.linkId)
          return req && req.status === 'pending'
        }
        if (alert.type === 'prebooking') {
          const booking = currentPreBookings.find(b => b.id === alert.linkId)
          return booking && booking.status === 'pending' && booking.payment_status === 'pending'
        }
        if (alert.type === 'roomchange') {
          const rc = currentRoomChangeRequests.find(r => r.id === alert.linkId)
          return rc && rc.status === 'pending'
        }
        return true
      })
    })
  }

  const detectNewItems = (newData, oldData, type, tab) => {
    if (newData.length > oldData.length) {
      const newItems = newData.filter(n => !oldData.some(o => o.id === n.id))
      newItems.forEach(item => {
        let message = ''
        if (type === 'vacate') message = `🚪 New vacate request from ${item.tenant_name}`
        else if (type === 'payment') message = `💰 New pending payment from ${item.tenants?.name || 'tenant'}`
        else if (type === 'complaint') message = `🔧 New complaint: ${item.title} from ${item.tenant_name}`
        else if (type === 'prebooking') message = `📋 New pre‑booking from ${item.name}`
        else if (type === 'roomchange') message = `🔄 New room change request from ${item.tenants?.name || 'tenant'}`
        if (message) addAlert(message, type, tab, item.id)
      })
    }
  }

  // ==========================================
  // FIXED: loadData WITHOUT Cleanup
  // ==========================================
  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    else setIsRefreshing(true)

    try {
      const userId = localStorage.getItem('userId')
      const { data: propertyData } = await supabase
        .from('properties')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle()
      if (propertyData) {
        setProperty(propertyData)
        setPropertyImages(propertyData.photos || [])
        updateMembershipFromProperty(propertyData)

        const { data: roomsData } = await supabase
          .from('rooms')
          .select('*')
          .eq('property_id', propertyData.id)
          .order('room_number')
        setRooms(roomsData || [])
        const total = roomsData?.length || 0
        const occupied = roomsData?.filter(r => r.current_occupants >= r.capacity).length || 0
        const vacant = total - occupied

        const { data: tenantsData } = await supabase
          .from('tenants')
          .select('*')
          .eq('property_id', propertyData.id)
        const tenantsWithRoomNumber = (tenantsData || []).map(tenant => {
          const room = roomsData?.find(r => r.id === tenant.room_id)
          return { ...tenant, room_number: room ? room.room_number : 'N/A', dueStatus: calculateRentDueStatus(tenant) }
        })
        setTenants(tenantsWithRoomNumber)
        const totalCollected = tenantsData?.reduce((sum, t) => sum + (t.total_paid || 0), 0) || 0
        const pendingAmount = tenantsData?.reduce((sum, t) => sum + (t.pending_amount || 0), 0) || 0
        const overdueCount = tenantsWithRoomNumber.filter(t => t.dueStatus.status === 'overdue').length
        const noticePeriodCount = tenantsWithRoomNumber.filter(t => t.status === 'notice_period').length
        const pendingPaymentCount = tenantsWithRoomNumber.filter(t => t.status === 'payment_pending').length
        const tenantIds = tenantsData?.map(t => t.id) || []

        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
        const { data: monthlyPayments } = await supabase
          .from('payment_history')
          .select('amount')
          .eq('status', 'success')
          .gte('payment_date', startOfMonth)
          .lte('payment_date', endOfMonth)
          .in('tenant_id', tenantIds)
        const monthlyIncome = monthlyPayments?.reduce((sum, p) => sum + p.amount, 0) || 0

        const { data: monthlyPaymentsWithTenant } = await supabase
          .from('payment_history')
          .select('amount, tenant_id, tenants!inner(room_id)')
          .eq('status', 'success')
          .gte('payment_date', startOfMonth)
          .lte('payment_date', endOfMonth)
          .in('tenant_id', tenantIds)
        const roomIncomeMap = {}
        if (monthlyPaymentsWithTenant) {
          monthlyPaymentsWithTenant.forEach(p => {
            const roomId = p.tenants?.room_id
            if (roomId) roomIncomeMap[roomId] = (roomIncomeMap[roomId] || 0) + p.amount
          })
        }
        setRoomMonthlyIncome(roomIncomeMap)

        const { data: allPmts } = await supabase
          .from('payment_history')
          .select('*, tenants(name, room_id, rooms(room_number))')
          .in('tenant_id', tenantIds)
          .order('payment_date', { ascending: false })
          .limit(100)
        setAllPayments(allPmts || [])

        const { data: pendingPayments } = await supabase
          .from('payment_history')
          .select('*, tenants(name, phone, room_id, rooms(room_number))')
          .eq('status', 'payment_pending')
          .in('tenant_id', tenantIds)
          .order('payment_date', { ascending: false })
        setPendingRentPayments(pendingPayments || [])
        const pendingRentConfirmations = pendingPayments?.length || 0

        setStats({
          totalRooms: total,
          occupied,
          vacant,
          totalCollected,
          pendingAmount,
          totalComplaints: 0,
          pendingVacate: 0,
          overdueCount,
          noticePeriodCount,
          pendingPaymentCount,
          pendingRentConfirmations,
          monthlyIncome
        })

        await supabase.from('complaints').delete().lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

        const { data: appsData } = await supabase
          .from('applications')
          .select('*')
          .eq('property_id', propertyData.id)
          .eq('status', 'pending')
        setApplications(appsData || [])

        const { data: vacateData } = await supabase
          .from('check_out_requests')
          .select('*')
          .eq('property_id', propertyData.id)
          .in('status', ['pending', 'approved'])
          .order('created_at', { ascending: false })
        detectNewItems(vacateData || [], previousDataRef.current.vacateRequests, 'vacate', 'vacate')
        previousDataRef.current.vacateRequests = vacateData || []
        setVacateRequests(vacateData || [])
        setStats(prev => ({ ...prev, pendingVacate: vacateData?.filter(v => v.status === 'pending').length || 0 }))

        const { data: preBookingsData } = await supabase
          .from('pre_bookings')
          .select('*, rooms(room_number)')
          .eq('property_id', propertyData.id)
          .order('created_at', { ascending: false })
        detectNewItems(preBookingsData || [], previousDataRef.current.preBookings, 'prebooking', 'pre-bookings')
        previousDataRef.current.preBookings = preBookingsData || []
        setPreBookings(preBookingsData || [])

        const { data: complaintsData } = await supabase
          .from('complaints')
          .select('*')
          .eq('property_id', propertyData.id)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
        detectNewItems(complaintsData || [], previousDataRef.current.complaints, 'complaint', 'complaints')
        previousDataRef.current.complaints = complaintsData || []
        setComplaints(complaintsData || [])
        setStats(prev => ({ ...prev, totalComplaints: complaintsData?.length || 0 }))

        detectNewItems(pendingPayments || [], previousDataRef.current.pendingRentPayments, 'payment', 'rent-payments')
        previousDataRef.current.pendingRentPayments = pendingPayments || []

        await loadRoomChangeRequests(propertyData.id)

        const { data: noticesData } = await supabase
          .from('notices')
          .select('*')
          .eq('property_id', propertyData.id)
          .order('created_at', { ascending: false })
        setNotices(noticesData || [])

        cleanStaleAlerts(vacateData || [], preBookingsData || [], roomChangeRequests)
      }
    } catch (error) {
      console.error('Load error:', error)
      if (!isBackground) toast.error('Failed to load data: ' + error.message)
    } finally {
      if (!isBackground) setLoading(false)
      else setIsRefreshing(false)
    }
  }, [])

  const loadRoomChangeRequests = async (propertyId) => {
    try {
      const { data, error } = await supabase
        .from('room_change_requests')
        .select(`
          *,
          tenants:tenant_id (id, name, phone, email, room_id, rent_amount),
          old_room:old_room_id (id, room_number),
          new_room:new_room_id (id, room_number, capacity, current_occupants, monthly_rent)
        `)
        .eq('property_id', propertyId)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })
      if (error) throw error
      detectNewItems(data || [], previousDataRef.current.roomChangeRequests, 'roomchange', 'room-change')
      previousDataRef.current.roomChangeRequests = data || []
      setRoomChangeRequests(data || [])
    } catch (error) {
      console.error('Load room change requests error:', error)
    }
  }

  const loadSettings = async () => {
    try {
      const userId = localStorage.getItem('userId')
      const { data, error } = await supabase
        .from('owner_settings')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle()
      if (error) throw error
      if (data) {
        setSettings({
          joining_fee: data.joining_fee || 0,
          advance_months: data.advance_months || 1,
          due_day: data.due_day || 5,
          upi_id: data.upi_id || '',
          upi_phone: data.upi_phone || ''
        })
      } else {
        setSettings({
          joining_fee: 0,
          advance_months: 1,
          due_day: 5,
          upi_id: property?.owner_upi_id || '',
          upi_phone: ''
        })
      }
      if (property && !settings.upi_id && property.owner_upi_id) {
        setSettings(prev => ({ ...prev, upi_id: property.owner_upi_id }))
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      toast.error('Failed to load settings')
    }
  }

  const saveSettings = async () => {
    if (isSubmitting) return
    if (!settings.upi_id.trim() && !settings.upi_phone.trim()) {
      toast.error('Please provide at least one UPI ID or UPI Phone Number')
      return
    }
    setIsSubmitting(true)
    try {
      const userId = localStorage.getItem('userId')
      const { data: existing, error: fetchError } = await supabase
        .from('owner_settings')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle()
      if (fetchError) throw fetchError

      const updateData = {
        joining_fee: settings.joining_fee,
        advance_months: settings.advance_months,
        due_day: settings.due_day,
        upi_id: settings.upi_id,
        upi_phone: settings.upi_phone,
        updated_at: new Date().toISOString(),
      }

      let error
      if (existing) {
        const { error: updateError } = await supabase
          .from('owner_settings')
          .update(updateData)
          .eq('owner_id', userId)
        error = updateError
      } else {
        const { error: insertError } = await supabase
          .from('owner_settings')
          .insert({
            owner_id: userId,
            ...updateData,
          })
        error = insertError
      }
      if (error) throw error

      if (property && settings.upi_id) {
        await supabase
          .from('properties')
          .update({ owner_upi_id: settings.upi_id })
          .eq('id', property.id)
      }

      toast.success('Settings saved successfully!')
      setShowSettingsModal(false)
      await loadSettings()
      await loadData(true)
    } catch (error) {
      console.error('Save settings error:', error)
      toast.error('Failed to save settings: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ----- Membership (unchanged) -----
  const updateMembershipFromProperty = (propertyData) => {
    if (!propertyData) {
      setMembershipActive(false)
      setMembershipStatus('none')
      setMembershipExpiry(null)
      setDaysLeft(null)
      return
    }
    const active = propertyData.membership_active && new Date(propertyData.membership_expiry) > new Date()
    setMembershipActive(active)
    setMembershipStatus(active ? 'active' : (propertyData.membership_active ? 'expired' : 'none'))
    if (propertyData.membership_expiry) {
      const expiryDate = new Date(propertyData.membership_expiry)
      const today = new Date()
      const remainingDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))
      setDaysLeft(remainingDays)
      setMembershipExpiry(expiryDate)
    } else {
      setMembershipExpiry(null)
      setDaysLeft(null)
    }
  }

  const initiateMembershipPayment = async (planId, amount, planName) => {
    setMembershipLoading(true)
    try {
      const response = await fetch('/api/payment/create-membership-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: localStorage.getItem('userId'),
          planId,
          amount,
          ownerName: localStorage.getItem('userName'),
          ownerEmail: localStorage.getItem('userEmail'),
        }),
      })
      const data = await response.json()
      if (data.success) {
        window.open(data.paymentLink, '_blank')
        toast.success('Redirecting to payment gateway...')
        setTimeout(async () => {
          await loadData(true)
          if (membershipActive) {
            setMembershipStatus('active')
            startAutoRefresh()
            toast.success('✅ Membership activated! Reloading...')
            window.location.reload()
          } else {
            toast('Payment processing – please wait a few moments.', { icon: '⏳' })
          }
        }, 15000)
      } else {
        toast.error(data.error || 'Payment initiation failed')
      }
    } catch (error) {
      console.error('Membership payment error:', error)
      toast.error('Failed to initiate payment')
    } finally {
      setMembershipLoading(false)
      setShowMembershipModal(false)
    }
  }

  // ----- Auto-refresh -----
  const startAutoRefresh = () => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
    autoRefreshRef.current = setInterval(() => {
      loadData(true)
    }, 15000)
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

  // ----- Handlers (Your original handlers, unchanged) -----
  const deleteRoom = async (id) => {
    if (isSubmitting) return
    const room = rooms.find(r => r.id === id)
    if (room.current_occupants > 0) { toast.error(`Cannot delete room with ${room.current_occupants} occupants`); return }
    if (!confirm(`Delete Room ${room.room_number}?`)) return
    setIsSubmitting(true)
    try {
      await supabase.from('rooms').delete().eq('id', id)
      toast.success('Room deleted')
      await loadData(true)
    } catch (error) { toast.error('Failed to delete room') }
    finally { setIsSubmitting(false) }
  }

  const addRoom = async () => {
    if (isSubmitting) return
    if (!roomForm.room_number) { toast.error('Enter room number'); return }
    if (rooms.some(r => r.room_number === roomForm.room_number)) { toast.error(`Room ${roomForm.room_number} already exists!`); return }
    setIsSubmitting(true)
    const selectedType = sharingTypes.find(t => t.value === roomForm.sharing_type)
    const { error } = await supabase.from('rooms').insert({
      property_id: property.id,
      room_number: roomForm.room_number,
      sharing_type: roomForm.sharing_type,
      monthly_rent: parseInt(roomForm.monthly_rent) || selectedType.price,
      capacity: selectedType.capacity,
      current_occupants: 0,
      status: 'vacant'
    })
    if (error) toast.error('Failed to add room: ' + error.message)
    else {
      toast.success(`Room ${roomForm.room_number} added!`)
      setShowRoomModal(false)
      setRoomForm({ room_number: '', sharing_type: 'double', monthly_rent: 10000 })
      loadData(true)
    }
    setIsSubmitting(false)
  }

  const addTenant = async () => {
    if (isSubmitting) return
    if (!formData.name || !formData.phone || !formData.email || !formData.rent_amount || !formData.room_id) {
      toast.error('Please fill all fields (Email is required)')
      return
    }
    const cleanPhone = cleanPhoneNumber(formData.phone)
    if (cleanPhone.length !== 10) { toast.error('Enter valid 10-digit phone number'); return }
    const selectedRoom = rooms.find(r => r.id === formData.room_id)
    if (!selectedRoom) { toast.error('Selected room not found'); return }
    if (selectedRoom.current_occupants >= selectedRoom.capacity) { toast.error(`Room ${selectedRoom.room_number} is full!`); return }
    setIsSubmitting(true)
    try {
      const tenantEmail = formData.email.trim()
      const joiningFee = parseInt(formData.joining_fee) || 0
      const advanceMonths = parseInt(formData.advance_amount) || 0
      const monthlyRent = parseInt(formData.rent_amount)
      const totalJoiningAmount = (monthlyRent * advanceMonths) + joiningFee
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: tenantEmail,
        password: Math.random().toString(36).slice(-8),
        options: { data: { full_name: formData.name, role: 'tenant', phone: cleanPhone } }
      })
      if (authError) throw authError
      const userId = authData.user.id
      await supabase.from('users').insert({ id: userId, email: tenantEmail, full_name: formData.name, phone: cleanPhone, role: 'tenant', is_active: true })
      const pendingAmount = advanceMonths > 0 ? 0 : monthlyRent
      const rentStatus = advanceMonths > 0 ? 'paid' : 'pending'
      const { data: newTenant, error: tenantError } = await supabase.from('tenants').insert({
        user_id: userId, property_id: property.id, room_id: selectedRoom.id, name: formData.name,
        phone: cleanPhone, email: tenantEmail, rent_amount: monthlyRent, pending_amount: pendingAmount,
        total_paid: totalJoiningAmount, rent_status: rentStatus,
        move_in_date: new Date().toISOString().split('T')[0], status: 'active'
      }).select().single()
      if (tenantError) throw tenantError
      if (totalJoiningAmount > 0 && newTenant) {
        await supabase.from('payment_history').insert({
          tenant_id: newTenant.id, amount: totalJoiningAmount,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'advance', status: 'success'
        })
      }
      const newOccupants = selectedRoom.current_occupants + 1
      const newStatus = newOccupants >= selectedRoom.capacity ? 'occupied' : 'vacant'
      await supabase.from('rooms').update({ current_occupants: newOccupants, status: newStatus }).eq('id', selectedRoom.id)
      await supabase.auth.resetPasswordForEmail(tenantEmail, { redirectTo: `${window.location.origin}/reset-password` }).catch(e => console.warn)
      toast.success(`Tenant "${formData.name}" added!`)
      setShowAddModal(false)
      setFormData({ name: '', phone: '', email: '', rent_amount: '', room_id: '', advance_amount: '0', joining_fee: '0' })
      await loadData(true)
    } catch (error) { toast.error('Failed to add tenant: ' + error.message) }
    finally { setIsSubmitting(false) }
  }

  const deleteTenantComplete = async (tenantId, roomId, userId) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await supabase.from('tenants').delete().eq('id', tenantId)
      if (userId) {
        const { error: userError } = await supabase.from('users').delete().eq('id', userId)
        if (userError) await supabase.from('users').update({ is_active: false, role: 'inactive' }).eq('id', userId)
      }
      toast.success('✅ Tenant and all related data permanently deleted!')
      await loadData(true)
    } catch (error) { toast.error('Failed to delete tenant: ' + error.message) }
    finally { setIsSubmitting(false); setShowConfirmDeleteModal(false); setTenantToDelete(null) }
  }

  const deleteTenantSoft = async (tenantId, roomId) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await supabase.from('tenants').delete().eq('id', tenantId)
      toast.success('Tenant removed from room (history preserved)')
      await loadData(true)
    } catch (error) { toast.error('Failed to remove tenant') }
    finally { setIsSubmitting(false); setShowConfirmDeleteModal(false); setTenantToDelete(null) }
  }

  const collectRent = async () => {
    if (isSubmitting) return
    if (!selectedTenant || !paymentAmount) { toast.error('Enter amount'); return }
    const amount = parseInt(paymentAmount)
    const maxAmount = selectedTenant.pending_amount || selectedTenant.rent_amount
    if (amount > maxAmount) { toast.error(`Max payable: ₹${maxAmount.toLocaleString()}`); return }
    setIsSubmitting(true)
    try {
      await supabase.from('payment_history').insert({
        tenant_id: selectedTenant.id, amount, payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash', status: 'success'
      })
      const newTotalPaid = (selectedTenant.total_paid || 0) + amount
      const newPendingAmount = maxAmount - amount
      const newRentStatus = newPendingAmount <= 0 ? 'paid' : 'pending'
      await supabase.from('tenants').update({
        total_paid: newTotalPaid, pending_amount: newPendingAmount,
        rent_status: newRentStatus, last_payment_date: new Date().toISOString().split('T')[0]
      }).eq('id', selectedTenant.id)
      toast.success(`₹${amount.toLocaleString()} collected!`)
      setShowPaymentModal(false)
      setPaymentAmount('')
      await loadData(true)
    } catch (error) { toast.error('Failed to collect rent: ' + error.message) }
    finally { setIsSubmitting(false) }
  }

  const confirmRentPayment = async (paymentId, tenantId, amount) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await supabase.from('payment_history').update({ status: 'success' }).eq('id', paymentId)
      const { data: tenant } = await supabase.from('tenants').select('total_paid, pending_amount, rent_amount').eq('id', tenantId).single()
      if (tenant) {
        const newTotalPaid = (tenant.total_paid || 0) + amount
        const newPending = Math.max(0, (tenant.pending_amount || 0) - amount)
        const newStatus = newPending <= 0 ? 'paid' : 'pending'
        await supabase.from('tenants').update({ total_paid: newTotalPaid, pending_amount: newPending, rent_status: newStatus, last_payment_date: new Date().toISOString().split('T')[0] }).eq('id', tenantId)
      }
      clearAlertForItem('payment', paymentId)
      toast.success('✅ Rent payment confirmed!')
      await loadData(true)
    } catch (error) { toast.error('Failed to confirm: ' + error.message) }
    finally { setIsSubmitting(false) }
  }

  const rejectRentPayment = async (paymentId) => {
    if (isSubmitting) return
    if (!confirm('Reject this payment? The record will be deleted.')) return
    setIsSubmitting(true)
    try {
      await supabase.from('payment_history').delete().eq('id', paymentId)
      clearAlertForItem('payment', paymentId)
      toast.success('Payment rejected and removed.')
      await loadData(true)
    } catch (error) { toast.error('Failed to reject: ' + error.message) }
    finally { setIsSubmitting(false) }
  }

  const confirmPayment = async (tenantId) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('tenants').update({ status: 'active' }).eq('id', tenantId)
      if (error) throw error
      toast.success('✅ Payment confirmed! Tenant now active.')
      clearAlertForItem('payment', tenantId)
      setShowPaymentConfirmModal(false)
      setConfirmingTenant(null)
      await loadData(true)
    } catch (error) { toast.error('Failed to confirm payment: ' + error.message) }
    finally { setIsSubmitting(false) }
  }

  const respondToComplaint = async () => {
    if (isSubmitting) return
    if (!selectedComplaint) return
    setIsSubmitting(true)
    try {
      await supabase.from('complaints').update({
        status: 'in_progress', admin_response: complaintResponse, responded_at: new Date().toISOString()
      }).eq('id', selectedComplaint.id)
      toast.success('Response sent')
      setShowComplaintResponseModal(false)
      setComplaintResponse('')
      await loadData(true)
    } catch (error) { toast.error('Failed to send response') }
    finally { setIsSubmitting(false) }
  }

  const resolveComplaint = async (complaintId) => {
    if (isSubmitting) return
    if (!confirm('Mark as resolved?')) return
    setIsSubmitting(true)
    try {
      await supabase.from('complaints').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', complaintId)
      toast.success('Complaint resolved')
      await loadData(true)
    } catch (error) { toast.error('Failed to resolve') }
    finally { setIsSubmitting(false) }
  }

  const approveVacateRequest = async (requestId, tenantId, roomId, expectedDate) => {
    if (isSubmitting) return
    if (!confirm('Approve vacate request? Tenant will be put on notice period.')) return
    setIsSubmitting(true)
    try {
      await supabase.from('check_out_requests').update({ status: 'approved', processed_at: new Date(), owner_notes: 'Vacation approved.' }).eq('id', requestId)
      await supabase.from('tenants').update({
        status: 'notice_period', check_out_requested: true,
        notice_period_start: new Date().toISOString().split('T')[0],
        notice_period_end: expectedDate
      }).eq('id', tenantId)
      clearAlertForItem('vacate', requestId)
      toast.success('Vacate request approved – tenant is now on notice period')
      await loadData(true)
    } catch (error) { toast.error('Failed to approve') }
    finally { setIsSubmitting(false) }
  }

  const postNotice = async () => {
    if (isSubmitting) return
    if (!noticeForm.title || !noticeForm.content) { toast.error('Please fill both title and content'); return }
    setIsSubmitting(true)
    try {
      await supabase.from('notices').insert({
        property_id: property.id, title: noticeForm.title, content: noticeForm.content,
        type: noticeForm.type, is_urgent: noticeForm.is_urgent, created_at: new Date().toISOString()
      })
      toast.success('Notice posted!')
      setShowNoticeModal(false)
      setNoticeForm({ title: '', content: '', type: 'general', is_urgent: false })
      await loadData(true)
    } catch (error) { toast.error('Failed to post notice: ' + error.message) }
    finally { setIsSubmitting(false) }
  }

  const deleteNotice = async (noticeId) => {
    if (isSubmitting) return
    if (!confirm('Delete this notice?')) return
    setIsSubmitting(true)
    try {
      setNotices(prev => prev.filter(n => n.id !== noticeId))
      const { error } = await supabase.from('notices').delete().eq('id', noticeId)
      if (error) throw error
      toast.success('Notice deleted')
      await loadData(true)
    } catch (error) {
      await loadData(true)
      toast.error('Failed to delete notice')
    } finally {
      setIsSubmitting(false)
    }
  }

  const approvePreBooking = async (bookingId, roomId, userId) => {
    if (isSubmitting) {
      toast.error('Please wait, already processing')
      return
    }
    if (!confirm('Approve this pre‑booking? The user will become a tenant and the room will be reserved.')) return
    setIsSubmitting(true)
    try {
      const { data: booking, error: fetchError } = await supabase
        .from('pre_bookings')
        .select('*, rooms(monthly_rent, capacity, room_number, property_id)')
        .eq('id', bookingId)
        .single()
      if (fetchError) throw fetchError
      if (!booking) throw new Error('Pre‑booking not found')
      if (booking.status !== 'pending' || booking.payment_status !== 'pending') {
        toast.error('This pre‑booking has already been processed or payment not pending')
        return
      }
      
      const moveInDate = new Date()
      moveInDate.setDate(moveInDate.getDate() + 7)
      const totalPaid = booking.pre_booking_fee_amount || 0
      const monthlyRent = booking.rooms.monthly_rent
      const pendingAmount = monthlyRent - totalPaid

      const { data: newTenant, error: tenantError } = await supabase.from('tenants').insert({
        user_id: userId,
        property_id: booking.property_id,
        room_id: booking.room_id,
        name: booking.name,
        phone: booking.phone,
        email: booking.email,
        rent_amount: monthlyRent,
        pending_amount: pendingAmount > 0 ? pendingAmount : 0,
        total_paid: totalPaid,
        rent_status: pendingAmount <= 0 ? 'paid' : 'pending',
        move_in_date: moveInDate.toISOString().split('T')[0],
        status: 'active'
      }).select().single()
      if (tenantError) throw tenantError

      if (totalPaid > 0 && newTenant) {
        await supabase.from('payment_history').insert({
          tenant_id: newTenant.id,
          amount: totalPaid,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'pre_booking',
          status: 'success'
        })
      }

      const { data: roomData } = await supabase
        .from('rooms')
        .select('current_occupants, capacity')
        .eq('id', booking.room_id)
        .single()
      const newOccupants = (roomData.current_occupants || 0) + 1
      const newStatus = newOccupants >= roomData.capacity ? 'occupied' : 'vacant'
      await supabase
        .from('rooms')
        .update({ current_occupants: newOccupants, status: newStatus })
        .eq('id', booking.room_id)

      await supabase.from('pre_bookings').delete().eq('id', bookingId)
      clearAlertForItem('prebooking', bookingId)

      toast.success('Pre‑booking approved! Tenant created.')
      await loadData(true)
    } catch (error) {
      console.error('Approve pre-booking error:', error)
      toast.error('Failed to approve pre‑booking: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const rejectPreBooking = async (bookingId) => {
    if (isSubmitting) return
    if (!confirm('Reject this pre‑booking? The user will be notified.')) return
    setIsSubmitting(true)
    try {
      await supabase
        .from('pre_bookings')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', bookingId)
      clearAlertForItem('prebooking', bookingId)
      toast.success('Pre‑booking rejected.')
      await loadData(true)
    } catch (error) {
      console.error('Reject pre-booking error:', error)
      toast.error('Failed to reject pre‑booking')
    } finally {
      setIsSubmitting(false)
    }
  }

  const approveRoomChange = async (request) => {
    if (isSubmitting) {
      toast.error('Please wait, already processing')
      return
    }
    if (!confirm(`Approve room change for ${request.tenants?.name} from Room ${request.old_room?.room_number} to Room ${request.new_room?.room_number}?`)) return
    setIsSubmitting(true)
    try {
      const { data: targetRoom, error: roomError } = await supabase
        .from('rooms')
        .select('capacity, current_occupants')
        .eq('id', request.new_room_id)
        .single()
      if (roomError) throw roomError
      if (targetRoom.current_occupants >= targetRoom.capacity) {
        toast.error(`Room ${request.new_room?.room_number} is now full. Cannot approve.`)
        return
      }
      await supabase.from('tenants').update({ room_id: request.new_room_id }).eq('id', request.tenant_id)
      const { data: oldRoom } = await supabase.from('rooms').select('current_occupants').eq('id', request.old_room_id).single()
      const newOldOccupants = Math.max(0, (oldRoom.current_occupants || 0) - 1)
      const newOldStatus = newOldOccupants === 0 ? 'vacant' : (newOldOccupants >= targetRoom.capacity ? 'occupied' : 'vacant')
      await supabase.from('rooms').update({ current_occupants: newOldOccupants, status: newOldStatus }).eq('id', request.old_room_id)
      const newNewOccupants = (targetRoom.current_occupants || 0) + 1
      const newNewStatus = newNewOccupants >= targetRoom.capacity ? 'occupied' : 'vacant'
      await supabase.from('rooms').update({ current_occupants: newNewOccupants, status: newNewStatus }).eq('id', request.new_room_id)
      await supabase.from('room_change_requests').update({ status: 'approved', processed_at: new Date().toISOString() }).eq('id', request.id)
      await supabase.from('check_out_requests').delete().eq('tenant_id', request.tenant_id)
      toast.success('Room change approved! Tenant moved successfully.')
      await loadData(true)
    } catch (error) {
      console.error('Approve room change error:', error)
      toast.error('Failed to approve room change: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const rejectRoomChange = async () => {
    if (!selectedRoomChangeRequest) return
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }
    setIsSubmitting(true)
    try {
      await supabase
        .from('room_change_requests')
        .update({ 
          status: 'rejected', 
          processed_at: new Date().toISOString(),
          rejection_reason: rejectionReason
        })
        .eq('id', selectedRoomChangeRequest.id)
      toast.success('Room change request rejected.')
      setShowRoomChangeReasonModal(false)
      setRejectionReason('')
      setSelectedRoomChangeRequest(null)
      await loadData(true)
    } catch (error) {
      console.error('Reject room change error:', error)
      toast.error('Failed to reject request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const fetchTenantPayments = async (tenant) => {
    setSelectedTenantForPayments(tenant)
    try {
      const { data, error } = await supabase.from('payment_history').select('*').eq('tenant_id', tenant.id).order('payment_date', { ascending: false })
      if (error) throw error
      setTenantPayments(data || [])
      setShowTenantPaymentsModal(true)
    } catch (error) { toast.error('Failed to load payment history') }
  }

  const fetchTenantApplication = async (tenant) => {
    setLoadingProfile(true)
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .or(`phone.eq.${tenant.phone},email.eq.${tenant.email}`)
        .eq('property_id', property.id)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw error
      setTenantApplication(data?.[0] || null)
      setSelectedProfileTenant(tenant)
      setShowTenantProfileModal(true)
    } catch (error) {
      console.error(error)
      toast.error('Could not fetch documents')
    } finally {
      setLoadingProfile(false)
    }
  }

  // ==========================================================================
  // ATOMIC APPROVAL (Uses SQL function to prevent duplicate errors)
  // ==========================================================================
  const approveApplication = async (appId) => {
    if (isSubmitting) {
      toast.error('Please wait, already processing')
      return
    }
    const app = applications.find(a => a.id === appId)
    if (!app || app.status !== 'pending') {
      toast.error('Application already processed or not found')
      return
    }
    setIsSubmitting(true)
    try {
      const room = rooms.find(r => r.id === app.room_id)
      if (!room) throw new Error('Room not found')

      const { data, error } = await supabase.rpc('create_tenant_from_application', {
        p_user_id: app.user_id || null,
        p_app_id: app.id,
        p_property_id: app.property_id,
        p_room_id: app.room_id,
        p_name: app.name,
        p_phone: app.phone,
        p_email: app.email,
        p_rent_amount: room.monthly_rent,
        p_move_in_date: app.expected_move_in || new Date().toISOString().split('T')[0]
      })
      
      if (error) throw error
      if (!data?.success) {
        toast.error(data?.message || 'Failed to create tenant')
      } else {
        toast.success('Application approved successfully!')
        setApplications(prev => prev.filter(a => a.id !== appId))
        await loadData(true)
      }
    } catch (error) {
      console.error('Approve error:', error)
      toast.error('Failed to approve: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const resendPasswordEmail = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      toast.success(`Password reset email resent to ${email}`)
    } catch (error) {
      console.error('Resend error:', error)
      toast.error('Failed to resend: ' + error.message)
    }
  }

  // ==========================================================================
  // Initial useEffect (Preserved, no beforeunload)
  // ==========================================================================
  useEffect(() => {
    const init = async () => {
      const auth = await checkAuthAndRedirect()
      if (!auth) return
      if (auth.role !== 'owner') {
        router.push('/login')
        return
      }
      localStorage.setItem('userId', auth.user.id)
      localStorage.setItem('userEmail', auth.user.email || '')
      localStorage.setItem('userName', auth.user.user_metadata?.full_name || '')
      await loadData(false)
      await loadSettings()
      if (property) {
        if (!membershipActive && membershipStatus === 'expired') {
          router.push('/owner/subscribe?reason=expired')
          return
        }
        startAutoRefresh()
      }
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

    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
      Object.values(alertTimeoutRef.current).forEach(clearTimeout)
      subscription.unsubscribe()
    }
  }, [])

  // ==========================================================================
  // SURGICAL REAL‑TIME SUBSCRIPTIONS (FULLY UPDATED)
  // ==========================================================================
  const triggerRefresh = useCallback((isBackground = true) => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      loadData(isBackground);
      refreshTimeoutRef.current = null;
    }, 1500);
  }, [loadData]);

  useEffect(() => {
    if (!property?.id) return

    // Complaints (Surgical Insert + Stats Update)
    const channelComplaints = supabase
      .channel('complaints-owner')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'complaints' },
        (payload) => {
          if (payload.new?.property_id === property.id) {
            console.log('🔧 New complaint:', payload.new)
            setComplaints(prev => [payload.new, ...prev])
            setStats(prev => ({ ...prev, totalComplaints: (prev.totalComplaints || 0) + 1 }))
            addAlert(`🔧 New complaint: ${payload.new.title}`, 'complaint', 'complaints', payload.new.id)
          }
        }
      )
      .subscribe()

    // Tenants (Surgical Insert)
    const channelTenants = supabase
      .channel('tenants-owner')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tenants' },
        (payload) => {
          if (payload.new?.property_id === property.id) {
            console.log('👤 New tenant:', payload.new)
            const tenantWithStatus = { ...payload.new, dueStatus: calculateRentDueStatus(payload.new) }
            setTenants(prev => [...prev, tenantWithStatus])
            setStats(prev => ({ ...prev, occupied: prev.occupied + 1, vacant: prev.vacant - 1 }))
          }
        }
      )
      .subscribe()

    // Payments (SURGICAL UPDATE FOR BADGE COUNT)
    const channelPayments = supabase
      .channel('payments-owner')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'payment_history' },
        (payload) => {
          console.log('💰 New pending payment:', payload.new)
          if (payload.new?.tenant_id) {
             setAllPayments(prev => [payload.new, ...prev])
             setPendingRentPayments(prev => [payload.new, ...prev])
             setStats(prev => ({ ...prev, pendingRentConfirmations: prev.pendingRentConfirmations + 1 }))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'payment_history' },
        (payload) => {
          if (payload.new?.tenant_id) {
             setAllPayments(prev => prev.map(p => p.id === payload.new.id ? payload.new : p))
             // If status changed to success, remove from pending list and decrement count
             if (payload.old.status === 'payment_pending' && payload.new.status === 'success') {
               setPendingRentPayments(prev => prev.filter(p => p.id !== payload.new.id))
               setStats(prev => ({ ...prev, pendingRentConfirmations: Math.max(0, prev.pendingRentConfirmations - 1) }))
             }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'payment_history' },
        (payload) => {
          if (payload.old?.tenant_id) {
             setAllPayments(prev => prev.filter(p => p.id !== payload.old.id))
             setPendingRentPayments(prev => prev.filter(p => p.id !== payload.old.id))
             setStats(prev => ({ ...prev, pendingRentConfirmations: Math.max(0, prev.pendingRentConfirmations - 1) }))
          }
        }
      )
      .subscribe()

    // Rooms (Debounced + No-op filter)
    const channelRooms = supabase
      .channel('rooms-owner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        (payload) => {
          if (payload.new?.property_id !== property.id) return;
          if (payload.old && payload.new && JSON.stringify(payload.old) === JSON.stringify(payload.new)) return;
          console.log('🏠 Room changed:', payload.new)
          setRooms(prev => prev.map(r => r.id === payload.new.id ? payload.new : r))
          triggerRefresh(true)
        }
      )
      .subscribe()

    // Vacate Requests (Surgical Updates)
    const channelVacate = supabase
      .channel('vacate-owner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'check_out_requests' },
        (payload) => {
          if (payload.new?.property_id !== property.id) return;
          if (payload.eventType === 'INSERT') {
            setVacateRequests(prev => [payload.new, ...prev])
            setStats(prev => ({ ...prev, pendingVacate: prev.pendingVacate + 1 }))
            addAlert(`🚪 New vacate request from ${payload.new.tenant_name}`, 'vacate', 'vacate', payload.new.id)
          } else if (payload.eventType === 'UPDATE') {
            setVacateRequests(prev => prev.map(v => v.id === payload.new.id ? payload.new : v))
            if (payload.old.status === 'pending' && payload.new.status !== 'pending') {
              setStats(prev => ({ ...prev, pendingVacate: Math.max(0, prev.pendingVacate - 1) }))
            } else if (payload.old.status !== 'pending' && payload.new.status === 'pending') {
              setStats(prev => ({ ...prev, pendingVacate: prev.pendingVacate + 1 }))
            }
          } else if (payload.eventType === 'DELETE') {
            setVacateRequests(prev => prev.filter(v => v.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    // Room Change Requests (Surgical Updates)
    const channelRoomChange = supabase
      .channel('roomchange-owner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_change_requests' },
        (payload) => {
          if (payload.new?.property_id !== property.id) return;
          if (payload.eventType === 'INSERT') {
            setRoomChangeRequests(prev => [payload.new, ...prev])
            addAlert(`🔄 New room change request`, 'roomchange', 'room-change', payload.new.id)
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.status !== 'pending') {
              setRoomChangeRequests(prev => prev.filter(r => r.id !== payload.new.id))
            } else {
              setRoomChangeRequests(prev => prev.map(r => r.id === payload.new.id ? payload.new : r))
            }
          } else if (payload.eventType === 'DELETE') {
            setRoomChangeRequests(prev => prev.filter(r => r.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channelComplaints)
      supabase.removeChannel(channelTenants)
      supabase.removeChannel(channelPayments)
      supabase.removeChannel(channelRooms)
      supabase.removeChannel(channelVacate)
      supabase.removeChannel(channelRoomChange)
    }
  }, [property?.id, triggerRefresh])

  // ==========================================================================
  // RETURN (Unchanged)
  // ==========================================================================
  return {
    loading,
    isRefreshing,
    property,
    rooms,
    tenants,
    applications,
    vacateRequests,
    complaints,
    notices,
    propertyImages,
    uploadingImage,
    setUploadingImage,
    showAddModal,
    setShowAddModal,
    showRoomModal,
    setShowRoomModal,
    showPaymentModal,
    setShowPaymentModal,
    showNoticeModal,
    setShowNoticeModal,
    showRoomDetailsModal,
    setShowRoomDetailsModal,
    showSettingsModal,
    setShowSettingsModal,
    selectedRoom,
    setSelectedRoom,
    selectedTenant,
    setSelectedTenant,
    selectedComplaint,
    setSelectedComplaint,
    showComplaintResponseModal,
    setShowComplaintResponseModal,
    complaintResponse,
    setComplaintResponse,
    formData,
    setFormData,
    roomForm,
    setRoomForm,
    noticeForm,
    setNoticeForm,
    paymentAmount,
    setPaymentAmount,
    activeTab,
    setActiveTab,
    isSubmitting,
    settings,
    setSettings,
    stats,
    showConfirmDeleteModal,
    setShowConfirmDeleteModal,
    tenantToDelete,
    setTenantToDelete,
    showMembershipModal,
    setShowMembershipModal,
    membershipActive,
    membershipLoading,
    membershipStatus,
    membershipExpiry,
    daysLeft,
    preBookings,
    showPaymentConfirmModal,
    setShowPaymentConfirmModal,
    confirmingTenant,
    setConfirmingTenant,
    pendingRentPayments,
    allPayments,
    roomMonthlyIncome,
    selectedApplication,
    setSelectedApplication,
    showApplicationDetailModal,
    setShowApplicationDetailModal,
    showTenantPaymentsModal,
    setShowTenantPaymentsModal,
    selectedTenantForPayments,
    setSelectedTenantForPayments,
    tenantPayments,
    showScreenshotModal,
    setShowScreenshotModal,
    screenshotUrl,
    setScreenshotUrl,
    searchTerm,
    setSearchTerm,
    showTenantProfileModal,
    setShowTenantProfileModal,
    selectedProfileTenant,
    setSelectedProfileTenant,
    tenantApplication,
    loadingProfile,
    roomChangeRequests,
    showRoomChangeReasonModal,
    setShowRoomChangeReasonModal,
    rejectionReason,
    setRejectionReason,
    selectedRoomChangeRequest,
    setSelectedRoomChangeRequest,
    alerts,
    getRoomNumberById,
    getTenantsInRoom,
    calculateRentDueStatus,
    getUpcomingVacateForRoom,
    handleAlertClick,
    removeAlert,
    loadData,
    loadSettings,
    saveSettings,
    initiateMembershipPayment,
    deleteRoom,
    addRoom,
    addTenant,
    deleteTenantComplete,
    deleteTenantSoft,
    collectRent,
    confirmRentPayment,
    rejectRentPayment,
    confirmPayment,
    respondToComplaint,
    resolveComplaint,
    approveVacateRequest,
    postNotice,
    deleteNotice,
    approvePreBooking,
    rejectPreBooking,
    approveRoomChange,
    rejectRoomChange,
    fetchTenantPayments,
    fetchTenantApplication,
    approveApplication,
    resendPasswordEmail,
    sharingTypes,
    startAutoRefresh,
    forceDeleteOverdueVacateTenants: async () => {},
    autoDeleteExpiredNoticeTenants: async () => {},
  }
}
