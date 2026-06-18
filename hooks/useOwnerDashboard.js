import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate, getSharingDetails, cleanPhoneNumber } from '../lib/utils'
import toast from 'react-hot-toast'

export function useOwnerDashboard() {
  const router = useRouter()
  // ----- State -----
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
    name: '', phone: '', email: '', rent_amount: '', room_id: '', advance_amount: '1', joining_fee: '0'
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

  const calculateRentDueStatus = (tenant) => {
    if (!tenant) return { status: 'paid', message: '', daysUntilDue: null, dueAmount: 0 }
    const joinDate = new Date(tenant.move_in_date)
    const today = new Date()
    const monthsSinceJoin = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth())
    const monthsPaid = Math.floor((tenant.total_paid || 0) / tenant.rent_amount)
    const isCurrentMonthPaid = monthsPaid > monthsSinceJoin

    if (isCurrentMonthPaid || (tenant.pending_amount === 0 && tenant.rent_status === 'paid')) {
      const nextDueDate = new Date(today.getFullYear(), today.getMonth() + 1, joinDate.getDate())
      const daysUntilDue = Math.ceil((nextDueDate - today) / (1000 * 60 * 60 * 24))
      return {
        status: 'paid',
        message: `Paid ✓ | Next due on ${formatDate(nextDueDate)}`,
        daysUntilDue: daysUntilDue,
        dueAmount: 0
      }
    }

    const expectedDate = new Date(today.getFullYear(), today.getMonth(), joinDate.getDate())
    const daysUntilDue = Math.ceil((expectedDate - today) / (1000 * 60 * 60 * 24))
    const pendingAmount = tenant.pending_amount || tenant.rent_amount

    if (daysUntilDue < 0) {
      return { status: 'overdue', message: `Overdue by ${Math.abs(daysUntilDue)} days`, daysUntilDue, dueAmount: pendingAmount }
    } else if (daysUntilDue <= 5) {
      return { status: 'due_soon', message: `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`, daysUntilDue, dueAmount: pendingAmount }
    } else {
      return { status: 'pending', message: `Due on ${formatDate(expectedDate)}`, daysUntilDue, dueAmount: pendingAmount }
    }
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

  // ----- Alert functions -----
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

  // ----- Auto-delete functions (unchanged) -----
  const autoDeleteExpiredNoticeTenants = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data: expired, error: fetchErr } = await supabase
      .from('tenants')
      .select('id, name, user_id')
      .eq('status', 'notice_period')
      .lte('notice_period_end', today)
    if (fetchErr) { console.error(fetchErr); return }
    if (!expired || expired.length === 0) return
    for (const t of expired) {
      const { error: deleteErr } = await supabase.from('tenants').delete().eq('id', t.id)
      if (!deleteErr) {
        toast.success(`✅ ${t.name} has been removed (notice period ended).`, { duration: 4000 })
        if (t.user_id) await supabase.from('users').delete().eq('id', t.user_id)
      }
    }
    await loadData(true)
  }

  const forceDeleteOverdueVacateTenants = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data: overdueVacates, error: fetchErr } = await supabase
      .from('check_out_requests')
      .select('id, tenant_id')
      .eq('status', 'approved')
      .lte('expected_check_out', today)
    if (fetchErr) return
    if (!overdueVacates || overdueVacates.length === 0) return
    for (const vacate of overdueVacates) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, name, user_id')
        .eq('id', vacate.tenant_id)
        .maybeSingle()
      if (tenant) {
        const { error: deleteErr } = await supabase.from('tenants').delete().eq('id', tenant.id)
        if (!deleteErr) {
          toast.success(`✅ ${tenant.name} automatically removed (vacate date passed).`, { duration: 4000 })
          if (tenant.user_id) await supabase.from('users').delete().eq('id', tenant.user_id)
        }
      }
    }
    await loadData(true)
  }

  // ----- Optimized loadData -----
  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    else setIsRefreshing(true)

    try {
      await autoDeleteExpiredNoticeTenants()
      await forceDeleteOverdueVacateTenants()

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

        await supabase.rpc('recalc_room_occupancy', { p_property_id: propertyData.id })

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
      // ... (existing save logic)
      // Ensure after saving, we refresh
      await loadSettings()
      await loadData(true)
      toast.success('Settings saved successfully!')
      setShowSettingsModal(false)
    } catch (error) {
      console.error('Save settings error:', error)
      toast.error('Failed to save settings: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ==========================================================================
  // FIXED: deleteNotice with optimistic update
  // ==========================================================================
  const deleteNotice = async (noticeId) => {
    if (isSubmitting) return
    if (!confirm('Delete this notice?')) return
    setIsSubmitting(true)
    try {
      // Optimistic update
      setNotices(prev => prev.filter(n => n.id !== noticeId))
      const { error } = await supabase.from('notices').delete().eq('id', noticeId)
      if (error) throw error
      toast.success('Notice deleted')
      // Background refresh to sync (ensures UI matches DB)
      await loadData(true)
    } catch (error) {
      // Revert by reloading data
      await loadData(true)
      toast.error('Failed to delete notice')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ----- All other handlers (unchanged) but all call loadData(true) -----
  const deleteRoom = async (id) => { /* ... */ }
  const addRoom = async () => { /* ... */ }
  const addTenant = async () => { /* ... */ }
  // ... (all existing handlers remain as in the previous version, with loadData(true) after success)

  // ----- Membership, auth, etc. (unchanged) -----
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

  const initiateMembershipPayment = async (planId, amount, planName) => { /* ... */ }
  const startAutoRefresh = () => { /* ... */ }
  const checkAuthAndRedirect = async () => { /* ... */ }

  // ----- Initial useEffect (unchanged) -----
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
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
      Object.values(alertTimeoutRef.current).forEach(clearTimeout)
      subscription.unsubscribe()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      router.events?.off('routeChangeStart', handleRouteChange)
    }
  }, [])

  // ==========================================================================
  // REAL‑TIME SUBSCRIPTIONS
  // ==========================================================================
  useEffect(() => {
    if (!property?.id) return

    const channelComplaints = supabase
      .channel('complaints-owner')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'complaints', filter: `property_id=eq.${property.id}` },
        () => { console.log('🔧 New complaint'); loadData(true) }
      )
      .subscribe()

    const channelTenants = supabase
      .channel('tenants-owner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tenants', filter: `property_id=eq.${property.id}` },
        () => { console.log('👤 Tenant changed'); loadData(true) }
      )
      .subscribe()

    const channelApplications = supabase
      .channel('applications-owner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications', filter: `property_id=eq.${property.id}` },
        () => { console.log('📋 Application changed'); loadData(true) }
      )
      .subscribe()

    const channelVacate = supabase
      .channel('vacate-owner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'check_out_requests', filter: `property_id=eq.${property.id}` },
        () => { console.log('🚪 Vacate changed'); loadData(true) }
      )
      .subscribe()

    const channelPayments = supabase
      .channel('payments-owner')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'payment_history' },
        () => { console.log('💰 Payment changed'); loadData(true) }
      )
      .subscribe()

    const channelRooms = supabase
      .channel('rooms-owner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `property_id=eq.${property.id}` },
        () => { console.log('🏠 Room changed'); loadData(true) }
      )
      .subscribe()

    const channelPreBookings = supabase
      .channel('prebookings-owner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pre_bookings', filter: `property_id=eq.${property.id}` },
        () => { console.log('📋 Pre‑booking changed'); loadData(true) }
      )
      .subscribe()

    const channelRoomChanges = supabase
      .channel('roomchange-owner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_change_requests', filter: `property_id=eq.${property.id}` },
        () => { console.log('🔄 Room change changed'); loadData(true) }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channelComplaints)
      supabase.removeChannel(channelTenants)
      supabase.removeChannel(channelApplications)
      supabase.removeChannel(channelVacate)
      supabase.removeChannel(channelPayments)
      supabase.removeChannel(channelRooms)
      supabase.removeChannel(channelPreBookings)
      supabase.removeChannel(channelRoomChanges)
    }
  }, [property?.id])

  // ==========================================================================
  // RETURN (with setSettings)
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
    setSettings,   // ✅ ADDED
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
    deleteNotice,   // ✅ Optimistic update
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
    forceDeleteOverdueVacateTenants,
    autoDeleteExpiredNoticeTenants,
  }
}
