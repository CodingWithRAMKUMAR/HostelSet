import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate, getSharingDetails, cleanPhoneNumber } from '../../lib/utils'
import toast from 'react-hot-toast'

export default function OwnerDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
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
    pendingPaymentCount: 0, pendingRentConfirmations: 0
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

  // ========== ALERTS STATE ==========
  const [alerts, setAlerts] = useState([])
  const alertTimeoutRef = useRef({})

  const previousDataRef = useRef({
    vacateRequests: [],
    pendingRentPayments: [],
    complaints: [],
    preBookings: []
  })

  const sharingTypes = [
    { value: 'single', label: 'Single Sharing', capacity: 1, icon: '👤', price: 15000 },
    { value: 'double', label: 'Double Sharing', capacity: 2, icon: '👥', price: 10000 },
    { value: 'triple', label: 'Triple Sharing', capacity: 3, icon: '👥👤', price: 8000 },
    { value: 'four', label: 'Four Sharing', capacity: 4, icon: '👥👥', price: 7000 },
    { value: 'five', label: 'Five Sharing', capacity: 5, icon: '👥👥👤', price: 6000 },
  ]

  const calculateRentDueStatus = (tenant) => {
    if (!tenant) return { status: 'paid', message: '', daysUntilDue: null, dueAmount: 0 }
    const joinDate = new Date(tenant.move_in_date)
    const today = new Date()
    const monthsSinceJoin = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth())
    const monthsPaid = Math.floor((tenant.total_paid || 0) / tenant.rent_amount)
    const isCurrentMonthPaid = monthsPaid > monthsSinceJoin
    if (isCurrentMonthPaid && (tenant.pending_amount === 0 || tenant.pending_amount < tenant.rent_amount)) {
      const nextDueDate = new Date(today.getFullYear(), today.getMonth() + 1, joinDate.getDate())
      const daysUntilDue = Math.ceil((nextDueDate - today) / (1000 * 60 * 60 * 24))
      return { status: 'paid', message: `Paid ✓ | Next due on ${formatDate(nextDueDate)}`, daysUntilDue, dueAmount: 0 }
    } else {
      const expectedDate = new Date(today.getFullYear(), today.getMonth(), joinDate.getDate())
      const daysUntilDue = Math.ceil((expectedDate - today) / (1000 * 60 * 60 * 24))
      const pendingAmount = tenant.pending_amount || tenant.rent_amount
      if (daysUntilDue < 0) return { status: 'overdue', message: `Overdue by ${Math.abs(daysUntilDue)} days`, daysUntilDue, dueAmount: pendingAmount }
      else if (daysUntilDue <= 5) return { status: 'due_soon', message: `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`, daysUntilDue, dueAmount: pendingAmount }
      else return { status: 'pending', message: `Due on ${formatDate(expectedDate)}`, daysUntilDue, dueAmount: pendingAmount }
    }
  }

  const getUpcomingVacateForRoom = (roomId) => {
    const vacate = vacateRequests.find(v => v.room_id === roomId && v.status === 'approved')
    if (!vacate) return null
    const vacateDate = new Date(vacate.expected_check_out)
    const today = new Date()
    const daysLeft = Math.ceil((vacateDate - today) / (1000 * 60 * 60 * 24))
    if (daysLeft < 0) return { date: vacate.expected_check_out, daysLeft: 0, overdue: true }
    return { date: vacate.expected_check_out, daysLeft, overdue: false }
  }

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

  const startAutoRefresh = () => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
    autoRefreshRef.current = setInterval(() => {
      loadData(true)
    }, 15000)
  }

  // ========== ALERT HANDLING ==========
  const addAlert = (message, type, linkTab, linkId = null) => {
    const id = Date.now() + Math.random()
    const newAlert = { id, message, type, linkTab, linkId, createdAt: Date.now() }
    setAlerts(prev => [newAlert, ...prev])
    // Auto-remove after 30 seconds
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
    if (alert.linkTab) {
      setActiveTab(alert.linkTab)
      if (alert.linkId && alert.linkTab === 'vacate') {
        // Optional: scroll to that request
      }
    }
    removeAlert(alert.id)
  }

  // Detect new items and create alerts
  const detectNewItems = (newData, oldData, type, tab) => {
    if (newData.length > oldData.length) {
      const newItems = newData.filter(n => !oldData.some(o => o.id === n.id))
      newItems.forEach(item => {
        let message = ''
        if (type === 'vacate') message = `🚪 New vacate request from ${item.tenant_name}`
        else if (type === 'payment') message = `💰 New pending payment from ${item.tenants?.name || 'tenant'}`
        else if (type === 'complaint') message = `🔧 New complaint: ${item.title} from ${item.tenant_name}`
        else if (type === 'prebooking') message = `📋 New pre‑booking from ${item.name}`
        if (message) addAlert(message, type, tab, item.id)
      })
    }
  }

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    const userRole = localStorage.getItem('userRole')
    if (!isLoggedIn || userRole !== 'owner') {
      router.push('/login')
      return
    }
    const initDashboard = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) {
        localStorage.clear()
        router.push('/login')
        return
      }
      await supabase.auth.setSession(session)
      await loadData()
      await loadSettings()
      await checkVacateAlerts()
      if (property) {
        if (!membershipActive) {
          if (membershipStatus === 'expired') {
            router.push('/owner/subscribe?reason=expired')
            return
          }
        } else {
          startAutoRefresh()
        }
      }
    }
    initDashboard()
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
      Object.values(alertTimeoutRef.current).forEach(clearTimeout)
    }
  }, [])

  const loadData = async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) setLoading(true)
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
          totalRooms: total, occupied, vacant, totalCollected, pendingAmount,
          totalComplaints: 0, pendingVacate: 0, overdueCount, noticePeriodCount,
          pendingPaymentCount, pendingRentConfirmations
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
        
        // Alerts for vacate
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

        const { data: noticesData } = await supabase
          .from('notices')
          .select('*')
          .eq('property_id', propertyData.id)
          .order('created_at', { ascending: false })
        setNotices(noticesData || [])
      }
    } catch (error) {
      console.error('Load error:', error)
      if (!isBackgroundRefresh) toast.error('Failed to load data: ' + error.message)
    } finally {
      if (!isBackgroundRefresh) setLoading(false)
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

  const ensureSingleOwnerSettingsRow = async (ownerId) => {
    const { data: rows, error } = await supabase
      .from('owner_settings')
      .select('*')
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false, nullsLast: true })
      .order('id', { ascending: false })
    if (error) throw error
    if (!rows || rows.length <= 1) return rows?.[0] || null

    const keep = rows[0]
    const merge = rows.slice(1)
    const mergedData = {
      joining_fee: keep.joining_fee,
      advance_months: keep.advance_months,
      due_day: keep.due_day,
      upi_id: keep.upi_id,
      upi_phone: keep.upi_phone,
      updated_at: keep.updated_at || new Date().toISOString()
    }
    for (const row of merge) {
      if (row.joining_fee !== null && row.joining_fee !== undefined) mergedData.joining_fee = row.joining_fee
      if (row.advance_months !== null && row.advance_months !== undefined) mergedData.advance_months = row.advance_months
      if (row.due_day !== null && row.due_day !== undefined) mergedData.due_day = row.due_day
      if (row.upi_id) mergedData.upi_id = row.upi_id
      if (row.upi_phone) mergedData.upi_phone = row.upi_phone
      if (row.updated_at && (!mergedData.updated_at || new Date(row.updated_at) > new Date(mergedData.updated_at))) {
        mergedData.updated_at = row.updated_at
      }
    }
    const { error: updateError } = await supabase
      .from('owner_settings')
      .update(mergedData)
      .eq('id', keep.id)
    if (updateError) throw updateError
    const deleteIds = merge.map(r => r.id)
    const { error: deleteError } = await supabase
      .from('owner_settings')
      .delete()
      .in('id', deleteIds)
    if (deleteError) throw deleteError
    return { id: keep.id, ...mergedData }
  }

  const saveSettings = async () => {
    if (!settings.upi_id.trim() && !settings.upi_phone.trim()) {
      toast.error('Please provide at least one UPI ID or UPI Phone Number')
      return
    }
    setIsSubmitting(true)
    try {
      const userId = localStorage.getItem('userId')
      await ensureSingleOwnerSettingsRow(userId)
      
      let { data: existing, error: fetchError } = await supabase
        .from('owner_settings')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle()
      
      if (fetchError && fetchError.message.includes('multiple')) {
        const { data: anyRow } = await supabase
          .from('owner_settings')
          .select('id')
          .eq('owner_id', userId)
          .limit(1)
          .maybeSingle()
        existing = anyRow
        fetchError = null
      }
      if (fetchError) throw fetchError
      
      let error
      if (existing) {
        const { error: updateError } = await supabase
          .from('owner_settings')
          .update({
            joining_fee: settings.joining_fee,
            advance_months: settings.advance_months,
            due_day: settings.due_day,
            upi_id: settings.upi_id,
            upi_phone: settings.upi_phone,
            updated_at: new Date().toISOString()
          })
          .eq('owner_id', userId)
        error = updateError
      } else {
        const { error: insertError } = await supabase
          .from('owner_settings')
          .insert({
            owner_id: userId,
            joining_fee: settings.joining_fee,
            advance_months: settings.advance_months,
            due_day: settings.due_day,
            upi_id: settings.upi_id,
            upi_phone: settings.upi_phone,
            updated_at: new Date().toISOString()
          })
        error = insertError
      }
      
      if (error) throw error

      if (property && settings.upi_id) {
        const { error: propError } = await supabase
          .from('properties')
          .update({ owner_upi_id: settings.upi_id })
          .eq('id', property.id)
        if (propError) console.warn('Property UPI update failed:', propError)
      }

      toast.success('Settings saved successfully!')
      setShowSettingsModal(false)
      await loadSettings()
    } catch (error) {
      console.error('Save settings error:', error)
      toast.error('Failed to save settings: ' + error.message)
    } finally {
      setIsSubmitting(false)
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
          await loadData()
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

  const checkVacateAlerts = () => {
    const today = new Date()
    vacateRequests.forEach(req => {
      if (req.status === 'approved') {
        const vacateDate = new Date(req.expected_check_out)
        const daysLeft = Math.ceil((vacateDate - today) / (1000 * 60 * 60 * 24))
        if (daysLeft === 7) toast(`🚪 ${req.tenant_name} vacates in 7 days!`, { duration: 5000, icon: '⚠️' })
        else if (daysLeft === 3) toast(`🚪 ${req.tenant_name} vacates in 3 days!`, { duration: 5000, icon: '⚠️' })
        else if (daysLeft === 1) toast.error(`🚪 ${req.tenant_name} vacates TOMORROW!`, { duration: 5000 })
        else if (daysLeft < 0) toast.error(`🚪 ${req.tenant_name} vacate date passed!`, { duration: 5000 })
      }
    })
  }

  const confirmPayment = async (tenantId) => {
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('tenants').update({ status: 'active' }).eq('id', tenantId)
      if (error) throw error
      toast.success('✅ Payment confirmed! Tenant now active.')
      setShowPaymentConfirmModal(false)
      setConfirmingTenant(null)
      await loadData()
    } catch (error) { toast.error('Failed to confirm payment: ' + error.message) }
    finally { setIsSubmitting(false) }
  }

  const confirmRentPayment = async (paymentId, tenantId, amount) => {
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
      toast.success('✅ Rent payment confirmed!')
      await loadData()
    } catch (error) { toast.error('Failed to confirm: ' + error.message) }
    finally { setIsSubmitting(false) }
  }

  const rejectRentPayment = async (paymentId) => {
    if (!confirm('Reject this payment? The record will be deleted.')) return
    setIsSubmitting(true)
    try {
      await supabase.from('payment_history').delete().eq('id', paymentId)
      toast.success('Payment rejected and removed.')
      await loadData()
    } catch (error) { toast.error('Failed to reject: ' + error.message) }
    finally { setIsSubmitting(false) }
  }

  // ========== FIXED: Approve pre‑booking with double-click prevention ==========
  const approvePreBooking = async (bookingId, roomId, userId) => {
    if (isSubmitting) {
      toast.error('Please wait, already processing')
      return
    }
    if (!confirm('Approve this pre‑booking? The user will become a tenant and the room will be reserved.')) return
    setIsSubmitting(true)
    try {
      // 1. Fetch the pre‑booking with room details, and check status
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
      
      // 2. Mark payment as success and approve pre‑booking
      const { error: updateError } = await supabase
        .from('pre_bookings')
        .update({ 
          payment_status: 'success',
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
      if (updateError) throw updateError

      // 3. Create tenant record (only once)
      const moveInDate = new Date()
      moveInDate.setDate(moveInDate.getDate() + 7)
      const totalPaid = booking.pre_booking_fee_amount || 0
      const pendingAmount = booking.rooms.monthly_rent - totalPaid

      const { error: tenantError } = await supabase.from('tenants').insert({
        user_id: booking.user_id,
        property_id: booking.property_id,
        room_id: booking.room_id,
        name: booking.name,
        phone: booking.phone,
        email: booking.email,
        rent_amount: booking.rooms.monthly_rent,
        pending_amount: pendingAmount > 0 ? pendingAmount : 0,
        total_paid: totalPaid,
        rent_status: pendingAmount <= 0 ? 'paid' : 'pending',
        move_in_date: moveInDate.toISOString().split('T')[0],
        status: 'active'
      })
      if (tenantError) throw tenantError

      // 4. Update room occupancy
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

      toast.success('Pre‑booking approved! Tenant record created.')
      await loadData()
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
      toast.success('Pre‑booking rejected.')
      await loadData()
    } catch (error) {
      console.error('Reject pre-booking error:', error)
      toast.error('Failed to reject pre‑booking')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ========== FIXED: Approve application with double-click prevention ==========
  const approveApplication = async (appId) => {
    if (isSubmitting) {
      toast.error('Please wait, already processing')
      return
    }
    setIsSubmitting(true)
    try {
      const { data: app } = await supabase.from('applications').select('*').eq('id', appId).single()
      if (!app || app.status !== 'pending') {
        toast.error('This application has already been processed')
        return
      }
      const { data: room } = await supabase.from('rooms').select('*').eq('id', app.room_id).single()
      let userId = null
      const { data: existingUser } = await supabase.from('users').select('id').eq('phone', app.phone).maybeSingle()
      if (existingUser) userId = existingUser.id
      else {
        const { data: newUser } = await supabase.from('users').insert({ phone: app.phone, email: app.email, full_name: app.name, role: 'tenant', is_active: true }).select().single()
        userId = newUser.id
      }
      await supabase.from('tenants').insert({
        user_id: userId, property_id: app.property_id, room_id: app.room_id, name: app.name,
        phone: app.phone, email: app.email, rent_amount: room.monthly_rent,
        pending_amount: room.monthly_rent, total_paid: 0, rent_status: 'pending',
        move_in_date: app.expected_move_in || new Date().toISOString().split('T')[0], status: 'active'
      })
      const newOccupants = (room.current_occupants || 0) + 1
      await supabase.from('rooms').update({ current_occupants: newOccupants, status: newOccupants >= room.capacity ? 'occupied' : 'vacant' }).eq('id', app.room_id)
      await supabase.from('applications').update({ status: 'approved', processed_at: new Date() }).eq('id', appId)
      toast.success('Application approved!')
      await loadData()
    } catch (error) {
      console.error('Approve error:', error)
      toast.error('Failed to approve: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getTenantsInRoom = (roomId) => tenants.filter(t => t.room_id === roomId)
  const getRoomNumberById = (roomId) => rooms.find(r => r.id === roomId)?.room_number || 'N/A'

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

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    setUploadingImage(true)
    let successCount = 0
    for (const file of files) {
      try {
        if (!file.type.startsWith('image/')) { toast.error(`${file.name} is not an image`); continue }
        if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5MB limit`); continue }
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`
        const filePath = `property-${property.id}/${fileName}`
        await supabase.storage.from('property-photos').upload(filePath, file, { cacheControl: '3600', upsert: false })
        const { data: { publicUrl } } = supabase.storage.from('property-photos').getPublicUrl(filePath)
        const newImages = [...propertyImages, publicUrl]
        await supabase.from('properties').update({ photos: newImages }).eq('id', property.id)
        setPropertyImages(newImages)
        successCount++
      } catch (error) { toast.error(`${file.name}: ${error.message}`) }
    }
    if (successCount > 0) toast.success(`${successCount} photo(s) uploaded!`)
    setUploadingImage(false)
    e.target.value = ''
  }

  const removeImage = async (imageUrl) => {
    setIsSubmitting(true)
    try {
      const newImages = propertyImages.filter(img => img !== imageUrl)
      await supabase.from('properties').update({ photos: newImages }).eq('id', property.id)
      setPropertyImages(newImages)
      toast.success('Photo removed')
    } catch (error) { toast.error('Failed to remove image') }
    finally { setIsSubmitting(false) }
  }

  const addRoom = async () => {
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
      loadData()
    }
    setIsSubmitting(false)
  }

  const addTenant = async () => {
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
      await loadData()
    } catch (error) { toast.error('Failed to add tenant: ' + error.message) }
    finally { setIsSubmitting(false) }
  }

  const deleteTenantComplete = async (tenantId, roomId, userId) => {
    setIsSubmitting(true)
    try {
      await supabase.from('tenants').delete().eq('id', tenantId)
      if (userId) {
        const { error: userError } = await supabase.from('users').delete().eq('id', userId)
        if (userError) await supabase.from('users').update({ is_active: false, role: 'inactive' }).eq('id', userId)
      }
      toast.success('✅ Tenant and all related data permanently deleted!')
      await loadData()
    } catch (error) { toast.error('Failed to delete tenant: ' + error.message) }
    finally { setIsSubmitting(false); setShowConfirmDeleteModal(false); setTenantToDelete(null) }
  }

  const deleteTenantSoft = async (tenantId, roomId) => {
    setIsSubmitting(true)
    try {
      await supabase.from('tenants').delete().eq('id', tenantId)
      toast.success('Tenant removed from room (history preserved)')
      await loadData()
    } catch (error) { toast.error('Failed to remove tenant') }
    finally { setIsSubmitting(false); setShowConfirmDeleteModal(false); setTenantToDelete(null) }
  }

  const postNotice = async () => {
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
      await loadData()
    } catch (error) { toast.error('Failed to post notice: ' + error.message) }
    finally { setIsSubmitting(false) }
  }

  const deleteNotice = async (noticeId) => {
    if (!confirm('Delete this notice?')) return
    setIsSubmitting(true)
    try {
      await supabase.from('notices').delete().eq('id', noticeId)
      toast.success('Notice deleted')
      await loadData()
    } catch (error) { toast.error('Failed to delete notice') }
    finally { setIsSubmitting(false) }
  }

  const collectRent = async () => {
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
      await loadData()
    } catch (error) { toast.error('Failed to collect rent: ' + error.message) }
    finally { setIsSubmitting(false) }
  }

  const respondToComplaint = async () => {
    if (!selectedComplaint) return
    setIsSubmitting(true)
    try {
      await supabase.from('complaints').update({
        status: 'in_progress', admin_response: complaintResponse, responded_at: new Date().toISOString()
      }).eq('id', selectedComplaint.id)
      toast.success('Response sent')
      setShowComplaintResponseModal(false)
      setComplaintResponse('')
      await loadData()
    } catch (error) { toast.error('Failed to send response') }
    finally { setIsSubmitting(false) }
  }

  const resolveComplaint = async (complaintId) => {
    if (!confirm('Mark as resolved?')) return
    setIsSubmitting(true)
    try {
      await supabase.from('complaints').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', complaintId)
      toast.success('Complaint resolved')
      await loadData()
    } catch (error) { toast.error('Failed to resolve') }
    finally { setIsSubmitting(false) }
  }

  const approveVacateRequest = async (requestId, tenantId, roomId) => {
    if (!confirm('Approve vacate request? Tenant will be put on notice period.')) return
    setIsSubmitting(true)
    try {
      await supabase.from('check_out_requests').update({ status: 'approved', processed_at: new Date(), owner_notes: 'Vacation approved.' }).eq('id', requestId)
      await supabase.from('tenants').update({
        status: 'notice_period', check_out_requested: true,
        notice_period_start: new Date().toISOString().split('T')[0],
        notice_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }).eq('id', tenantId)
      toast.success('Vacate request approved – tenant is now on notice period')
      await loadData()
    } catch (error) { toast.error('Failed to approve') }
    finally { setIsSubmitting(false) }
  }

  const deleteRoom = async (id) => {
    const room = rooms.find(r => r.id === id)
    if (room.current_occupants > 0) { toast.error(`Cannot delete room with ${room.current_occupants} occupants`); return }
    if (!confirm(`Delete Room ${room.room_number}?`)) return
    setIsSubmitting(true)
    try {
      await supabase.from('rooms').delete().eq('id', id)
      toast.success('Room deleted')
      await loadData()
    } catch (error) { toast.error('Failed to delete room') }
    finally { setIsSubmitting(false) }
  }

  const handleLogout = () => {
    localStorage.clear()
    router.push('/')
  }

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.room_number && t.room_number.toString().includes(searchTerm))
  )
  const filteredPayments = allPayments.filter(p =>
    p.tenants?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.tenants?.rooms?.room_number && p.tenants.rooms.room_number.toString().includes(searchTerm))
  )

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    </div>
  )

  if (!property) return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">🏠 HOSTELSET</h1>
        <button onClick={handleLogout} className="text-red-500">Logout</button>
      </nav>
      <div className="text-center py-20">
        <div className="text-6xl mb-6">🏠</div>
        <h1 className="text-2xl font-bold mb-4">Welcome to HOSTELSET!</h1>
        <Link href="/owner/register-property" className="bg-slate-800 text-white px-6 py-3 rounded-full font-semibold hover:bg-slate-700 transition">
          Register Your First Property →
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      {/* Subscription Banner */}
      {!membershipActive && (
        <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-3 text-center sticky top-0 z-50">
          <p className="text-yellow-800 font-semibold">
            ⭐ You're exploring the dashboard with limited access. 
            <button onClick={() => setShowMembershipModal(true)} className="ml-2 underline text-yellow-900 font-bold hover:text-yellow-950">
              Subscribe now
            </button> to unlock all features.
          </p>
        </div>
      )}

      {/* Membership Expiry Alert */}
      {membershipActive && daysLeft !== null && daysLeft <= 7 && daysLeft > 0 && (
        <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-3 text-center">
          <p className="text-yellow-800 font-semibold">
            ⚠️ Your membership will expire in {daysLeft} day{daysLeft !== 1 ? 's' : ''} on {formatDate(membershipExpiry)}. 
            <button onClick={() => setShowMembershipModal(true)} className="ml-2 underline font-bold">Renew now</button>
          </p>
        </div>
      )}
      {membershipActive && daysLeft !== null && daysLeft <= 0 && (
        <div className="bg-red-100 border-b border-red-300 px-4 py-3 text-center">
          <p className="text-red-800 font-semibold">
            ❌ Your membership has expired! 
            <button onClick={() => setShowMembershipModal(true)} className="ml-2 underline font-bold">Renew now</button>
          </p>
        </div>
      )}

      {/* Pending payment alert */}
      {stats.pendingPaymentCount > 0 && (
        <div className="bg-red-100 border-b border-red-300 px-4 py-3 text-center">
          <p className="text-red-800 font-semibold">
            ⚠️ You have {stats.pendingPaymentCount} pending payment{stats.pendingPaymentCount > 1 ? 's' : ''}. 
            <button onClick={() => setActiveTab('tenants')} className="ml-2 underline text-red-900 font-bold">
              Review now
            </button>
          </p>
        </div>
      )}

      {/* ========== NEW ALERTS SECTION ========== */}
      {alerts.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-4 py-2 shadow-sm">
          <div className="container mx-auto">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">🔔 Notifications</h3>
            <div className="space-y-1">
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2 cursor-pointer transition"
                  onClick={() => handleAlertClick(alert)}
                >
                  <span className="text-sm">{alert.message}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeAlert(alert.id); }}
                    className="text-gray-400 hover:text-gray-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 px-6 py-4">
        <div className="container mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">🏠 HOSTELSET</h1>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Owner</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <input
              type="text"
              placeholder="🔍 Search by name or room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
            <button
              onClick={() => setShowMembershipModal(true)}
              className={`px-3 py-1 rounded-lg text-sm font-semibold transition ${
                membershipActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {membershipActive ? '✅ Active' : '⭐ Buy Membership'}
            </button>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="text-gray-500 hover:text-slate-800 transition px-3 py-1 rounded-lg hover:bg-gray-100"
            >
              ⚙️ Settings
            </button>
            <span className="text-sm hidden md:inline text-gray-500">{property.name}</span>
            <button onClick={handleLogout} className="text-red-500 hover:text-red-600 transition">Logout</button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-2xl font-bold text-slate-800">{stats.totalRooms}</div>
            <div className="text-xs text-gray-500">Total Rooms</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.occupied}</div>
            <div className="text-xs text-gray-500">Occupied</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-2xl font-bold text-orange-500">{stats.vacant}</div>
            <div className="text-xs text-gray-500">Available</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-2xl font-bold text-blue-600">₹{stats.totalCollected.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Collected</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.overdueCount}</div>
            <div className="text-xs text-gray-500">Overdue</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.noticePeriodCount}</div>
            <div className="text-xs text-gray-500">Notice Period</div>
          </div>
        </div>

        {/* Overview Alerts */}
        {activeTab === 'overview' && (
          <div>
            {stats.pendingRentConfirmations > 0 && (
              <div className="bg-red-50 rounded-xl p-4 mb-6 border border-red-100">
                <p className="font-semibold text-red-800">💸 {stats.pendingRentConfirmations} rent payment(s) awaiting confirmation. <button onClick={() => setActiveTab('rent-payments')} className="underline">Review</button></p>
              </div>
            )}
            {stats.pendingPaymentCount > 0 && (
              <div className="bg-red-50 rounded-xl p-4 mb-6 border border-red-100">
                <p className="font-semibold text-red-800">⚠️ {stats.pendingPaymentCount} tenant(s) awaiting payment confirmation. <button onClick={() => setActiveTab('tenants')} className="underline">Review</button></p>
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
              <h3 className="font-semibold text-slate-800 mb-4">📅 Due Today</h3>
              {tenants.filter(t => calculateRentDueStatus(t).daysUntilDue === 0).length === 0 ? (
                <p className="text-gray-500">No tenants due today.</p>
              ) : (
                <div className="space-y-3">
                  {tenants.filter(t => calculateRentDueStatus(t).daysUntilDue === 0).map(t => (
                    <div key={t.id} className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-700">{t.name}</p>
                        <p className="text-xs text-gray-400">Room {t.room_number || getRoomNumberById(t.room_id)}</p>
                      </div>
                      <p className="text-sm font-semibold text-red-600">Due: {formatCurrency(t.pending_amount || t.rent_amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button
            onClick={() => membershipActive && setShowAddModal(true)}
            disabled={!membershipActive}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
              membershipActive 
                ? 'bg-slate-800 text-white hover:bg-slate-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            + Add Tenant
          </button>
          <button
            onClick={() => membershipActive && setShowRoomModal(true)}
            disabled={!membershipActive}
            className={`border-2 px-5 py-2 rounded-full text-sm font-semibold transition ${
              membershipActive 
                ? 'border-slate-300 text-slate-700 hover:bg-slate-50' 
                : 'border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            + Add Room
          </button>
          <button
            onClick={() => membershipActive && setShowNoticeModal(true)}
            disabled={!membershipActive}
            className={`border-2 px-5 py-2 rounded-full text-sm font-semibold transition ${
              membershipActive 
                ? 'border-slate-300 text-slate-700 hover:bg-slate-50' 
                : 'border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            📢 Post Notice
          </button>
          <button
            onClick={() => membershipActive && setShowSettingsModal(true)}
            disabled={!membershipActive}
            className={`border-2 px-5 py-2 rounded-full text-sm font-semibold transition ${
              membershipActive 
                ? 'border-blue-300 text-blue-700 hover:bg-blue-50' 
                : 'border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            ⚙️ Settings
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-gray-200 mb-6 gap-2">
          {['overview', 'rooms', 'tenants', 'rent-payments', 'payment-history', 'pre-bookings', 'complaints', 'vacate', 'applications', 'notices'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              disabled={!membershipActive}
              className={`px-5 py-2 text-sm font-semibold capitalize transition-all rounded-t-lg ${
                activeTab === tab 
                  ? 'bg-slate-800 text-white' 
                  : membershipActive 
                    ? 'text-gray-500 hover:text-slate-700 hover:bg-gray-50' 
                    : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              {tab === 'rent-payments' && `💸 Rent Payments (${stats.pendingRentConfirmations})`}
              {tab === 'payment-history' && '💳 Payment History'}
              {tab === 'pre-bookings' && `📋 Pre‑bookings (${preBookings.length})`}
              {tab === 'overview' && '📊 Overview'}
              {tab === 'rooms' && `🏠 Rooms (${rooms.length})`}
              {tab === 'tenants' && `👥 Tenants (${tenants.length})`}
              {tab === 'complaints' && `🔧 Complaints ${stats.totalComplaints > 0 ? `(${stats.totalComplaints})` : ''}`}
              {tab === 'vacate' && `🚪 Vacate ${stats.pendingVacate > 0 ? `(${stats.pendingVacate})` : ''}`}
              {tab === 'applications' && `📋 Applications ${applications.length > 0 ? `(${applications.length})` : ''}`}
              {tab === 'notices' && `📢 Notices (${notices.length})`}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="font-semibold text-slate-800 mb-4">📋 Recent Tenants</h3>
              <div className="space-y-3">
                {tenants.slice(0,5).map(t => {
                  const ds = calculateRentDueStatus(t)
                  return (
                    <div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-700">{t.name}</p>
                        <p className="text-xs text-gray-400">Room {t.room_number || getRoomNumberById(t.room_id)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-700">{formatCurrency(t.rent_amount)}</p>
                        <p className={`text-xs ${ds.status === 'overdue' ? 'text-red-500' : ds.status === 'due_soon' ? 'text-orange-500' : 'text-green-500'}`}>{ds.message}</p>
                      </div>
                    </div>
                  )
                })}
                {tenants.length === 0 && <p className="text-gray-400 text-center py-4">No tenants yet</p>}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="font-semibold text-slate-800 mb-4">🔧 Recent Complaints</h3>
              <div className="space-y-3">
                {complaints.slice(0,5).map(c => (
                  <div key={c.id} className="p-3 bg-orange-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-orange-700">{c.title}</p>
                        <p className="text-xs text-gray-500 mt-1">From: {c.tenant_name}</p>
                      </div>
                      <button
                        onClick={() => { setSelectedComplaint(c); setShowComplaintResponseModal(true) }}
                        className="text-xs bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700"
                      >
                        Respond
                      </button>
                    </div>
                  </div>
                ))}
                {complaints.length === 0 && <p className="text-gray-400 text-center py-4">No complaints yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => {
              const sharing = getSharingDetails(room.sharing_type)
              const isFull = room.current_occupants >= room.capacity
              const availableSlots = room.capacity - room.current_occupants
              const roomTenants = getTenantsInRoom(room.id)
              const upcomingVacate = getUpcomingVacateForRoom(room.id)
              return (
                <div
                  key={room.id}
                  onClick={() => { setSelectedRoom(room); setShowRoomDetailsModal(true) }}
                  className={`bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100 overflow-hidden relative ${isFull ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-gradient-to-br from-slate-50 to-gray-50'}`}
                >
                  {upcomingVacate && (
                    <div className={`absolute top-2 right-2 z-10 px-2 py-1 rounded-full text-xs font-bold ${upcomingVacate.daysLeft <= 3 ? 'bg-red-500 text-white animate-pulse' : 'bg-orange-500 text-white'}`}>
                      🚪 Vacates {upcomingVacate.daysLeft > 0 ? `in ${upcomingVacate.daysLeft} days` : 'overdue'}
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-2xl font-bold text-slate-800">Room {room.room_number}</h3>
                        <p className="text-sm text-gray-500 mt-1">{sharing.label} {sharing.icon}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${isFull ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>
                        {isFull ? 'Full' : `${availableSlots} slot available`}
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-2xl font-bold text-slate-800">{formatCurrency(room.monthly_rent)}<span className="text-sm text-gray-400">/month</span></p>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Occupancy</span>
                        <span className="text-slate-600">{room.current_occupants}/{room.capacity}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full bg-gradient-to-r from-slate-600 to-slate-500" style={{ width: `${(room.current_occupants / room.capacity) * 100}%` }}></div>
                      </div>
                    </div>
                    {roomTenants.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">Current Residents:</p>
                        <div className="flex -space-x-2">
                          {roomTenants.slice(0,3).map((tenant, idx) => (
                            <div key={tenant.id} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 border-2 border-white">
                              {tenant.name.charAt(0)}
                            </div>
                          ))}
                          {roomTenants.length > 3 && (
                            <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold text-slate-700 border-2 border-white">
                              +{roomTenants.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 pt-2 flex justify-end">
                      <button onClick={(e) => { e.stopPropagation(); deleteRoom(room.id) }} className="text-red-400 hover:text-red-600 text-xs">
                        Delete Room
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {rooms.length === 0 && (
              <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl">
                <div className="text-5xl mb-3">🏠</div>
                <p className="text-gray-500">No rooms added yet</p>
                <button onClick={() => setShowRoomModal(true)} className="mt-3 text-slate-600 underline">Add your first room</button>
              </div>
            )}
          </div>
        )}

        {/* Tenants Tab - FIXED (no stray characters) */}
        {activeTab === 'tenants' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Room</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Rent</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Paid</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Pending</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map(t => {
                  const dueStatus = calculateRentDueStatus(t)
                  const isNoticePeriod = t.status === 'notice_period'
                  const isPaymentPending = t.status === 'payment_pending'
                  const vacateRequest = vacateRequests.find(v => v.tenant_id === t.id && v.status === 'approved')
                  const vacateDate = vacateRequest ? new Date(vacateRequest.expected_check_out) : null
                  const daysToVacate = vacateDate ? Math.ceil((vacateDate - new Date()) / (1000 * 60 * 60 * 24)) : null
                  return (
                    <tr key={t.id} className={`border-b hover:bg-gray-50 ${dueStatus.status === 'overdue' ? 'bg-red-50' : dueStatus.status === 'due_soon' ? 'bg-orange-50' : ''} ${isNoticePeriod ? 'bg-purple-50' : ''} ${isPaymentPending ? 'bg-yellow-50' : ''}`}>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                            {t.name?.charAt(0).toUpperCase()}
                          </div>
                          <span>{t.name}</span>
                          {isNoticePeriod && <span className="ml-1 text-xs bg-purple-200 text-purple-800 px-1 rounded">Notice</span>}
                          {isPaymentPending && <span className="ml-1 text-xs bg-yellow-200 text-yellow-800 px-1 rounded">Payment Pending</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{t.phone}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">Room {t.room_number || getRoomNumberById(t.room_id)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{formatCurrency(t.rent_amount)}</td>
                      <td className="px-4 py-3 text-green-600 font-semibold">{formatCurrency(t.total_paid || 0)}</td>
                      <td className="px-4 py-3 text-red-500 font-semibold">{formatCurrency(t.pending_amount || t.rent_amount)}</td>
                      <td className="px-4 py-3">
                        {dueStatus.status === 'overdue' && <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">⚠️ {dueStatus.message}</span>}
                        {dueStatus.status === 'due_soon' && <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">📢 {dueStatus.message}</span>}
                        {dueStatus.status === 'pending' && <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">💰 {dueStatus.message}</span>}
                        {dueStatus.status === 'paid' && <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">✅ {dueStatus.message}</span>}
                        {isNoticePeriod && daysToVacate !== null && daysToVacate > 0 && (
                          <span className="ml-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">🚪 Vacates in {daysToVacate} days</span>
                        )}
                        {isNoticePeriod && daysToVacate !== null && daysToVacate <= 0 && (
                          <span className="ml-1 px-2 py-1 bg-red-200 text-red-800 rounded-full text-xs">⚠️ Vacate overdue</span>
                        )}
                        {isPaymentPending && (
                          <span className="ml-1 px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full text-xs">⏳ Awaiting approval</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isPaymentPending ? (
                          <button onClick={() => { setConfirmingTenant(t); setShowPaymentConfirmModal(true) }} className="bg-yellow-600 text-white px-3 py-1 rounded text-xs mr-2">Confirm Payment</button>
                        ) : (
                          <>
                            <button onClick={() => { setSelectedTenant(t); setShowPaymentModal(true) }} className="bg-slate-800 text-white px-3 py-1 rounded text-xs mr-2">Collect</button>
                            <button onClick={() => fetchTenantPayments(t)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs mr-2">📜 History</button>
                            <button onClick={() => fetchTenantApplication(t)} className="bg-purple-600 text-white px-3 py-1 rounded text-xs mr-2">👤 Profile</button>
                          </>
                        )}
                        <button onClick={() => { setTenantToDelete(t); setShowConfirmDeleteModal(true) }} className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600 transition">Delete</button>
                      </td>
                    </tr>
                  )
                })}
                {filteredTenants.length === 0 && (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-gray-500">No tenants match your search</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Rent Payments Tab */}
        {activeTab === 'rent-payments' && (
          <div className="space-y-4">
            {pendingRentPayments.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-xl">No pending rent payments.</div>
            )}
            {pendingRentPayments.map(p => (
              <div key={p.id} className="bg-white rounded-xl border p-4 flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <p className="font-semibold">{p.tenants?.name || 'N/A'}</p>
                  <p className="text-sm text-gray-500">Room {p.tenants?.rooms?.room_number || 'N/A'}</p>
                  <p className="text-sm">Amount: {formatCurrency(p.amount)}</p>
                  <p className="text-sm">Date: {formatDate(p.payment_date)}</p>
                  {p.upi_transaction_id && <p className="text-xs text-gray-500">UTR: {p.upi_transaction_id}</p>}
                  {p.payment_screenshot && (
                    <div className="mt-2">
                      <button onClick={() => { setScreenshotUrl(p.payment_screenshot); setShowScreenshotModal(true); }}>
                        <img src={p.payment_screenshot} alt="Payment proof" className="max-h-32 rounded-lg border cursor-pointer hover:opacity-80 transition" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => confirmRentPayment(p.id, p.tenant_id, p.amount)} disabled={isSubmitting} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition">Received</button>
                  <button onClick={() => rejectRentPayment(p.id)} disabled={isSubmitting} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition">Not Received</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payment History Tab */}
        {activeTab === 'payment-history' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Tenant</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Room</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Method</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map(p => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(p.payment_date)}</td>
                    <td className="px-4 py-3 font-medium">{p.tenants?.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.tenants?.rooms?.room_number || getRoomNumberById(p.tenants?.room_id)}</td>
                    <td className="px-4 py-3 font-semibold text-green-600">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 capitalize text-gray-500">{p.payment_method}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        p.status === 'success' ? 'bg-green-100 text-green-700' : 
                        p.status === 'payment_pending' ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {p.status === 'success' ? 'Success' : p.status === 'payment_pending' ? 'Pending' : p.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-gray-500">No payment records match your search</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pre‑bookings Tab – UPDATED */}
        {activeTab === 'pre-bookings' && (
          <div className="space-y-4">
            {preBookings.filter(b => b.status === 'pending' && b.payment_status === 'pending').length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-xl">No pending pre‑bookings waiting for payment verification.</div>
            )}
            {preBookings.filter(b => b.status === 'pending' && b.payment_status === 'pending').map(booking => {
              const amountPaid = booking.pre_booking_fee_amount || 0
              return (
                <div key={booking.id} className="bg-white rounded-xl border p-4 flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div>
                    <p className="font-semibold">{booking.name}</p>
                    <p className="text-sm text-gray-500">📞 {booking.phone}</p>
                    <p className="text-sm text-gray-500">📧 {booking.email || 'No email'}</p>
                    <p className="text-sm">Room: {booking.rooms?.room_number || 'N/A'}</p>
                    <p className="text-sm">Message: {booking.message || 'None'}</p>
                    <p className="text-sm font-semibold text-green-600">Pre‑booking fee paid: {formatCurrency(amountPaid)}</p>
                    {booking.payment_screenshot && (
                      <div className="mt-2">
                        <button onClick={() => { setScreenshotUrl(booking.payment_screenshot); setShowScreenshotModal(true); }} className="text-blue-600 underline text-sm">View Payment Screenshot</button>
                      </div>
                    )}
                    {booking.payment_transaction_id && <p className="text-xs text-gray-400">UTR: {booking.payment_transaction_id}</p>}
                    <p className="text-xs text-gray-400">Requested: {formatDate(booking.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => approvePreBooking(booking.id, booking.room_id, booking.user_id)}
                      disabled={isSubmitting}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition"
                    >
                      Approve & Create Tenant
                    </button>
                    <button
                      onClick={() => rejectPreBooking(booking.id)}
                      disabled={isSubmitting}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Complaints Tab */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            {complaints.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">{c.priority || 'Medium'}</span>
                      <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                    </div>
                    <h3 className="font-semibold text-slate-800">{c.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">From: {c.tenant_name}</p>
                    <p className="text-gray-600 mt-2">{c.description}</p>
                    {c.admin_response && <p className="text-sm text-green-600 mt-2 bg-green-50 p-2 rounded">Response: {c.admin_response}</p>}
                  </div>
                  <div className="flex gap-2">
                    {c.status === 'open' && (<button onClick={() => { setSelectedComplaint(c); setShowComplaintResponseModal(true) }} className="bg-slate-800 text-white px-3 py-1 rounded text-sm">Respond</button>)}
                    {c.status === 'in_progress' && (<button onClick={() => resolveComplaint(c.id)} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Resolve</button>)}
                  </div>
                </div>
                <div className="mt-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${c.status === 'open' ? 'bg-red-100 text-red-700' : c.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {c.status === 'open' ? 'Open' : c.status === 'in_progress' ? 'In Progress' : 'Resolved'}
                  </span>
                </div>
              </div>
            ))}
            {complaints.length === 0 && <div className="text-center py-12 bg-gray-50 rounded-xl"><div className="text-5xl mb-3">✅</div><p className="text-gray-500">No complaints to review</p></div>}
          </div>
        )}

        {/* Vacate Tab */}
        {activeTab === 'vacate' && (
          <div className="space-y-4">
            {vacateRequests.map(req => {
              const expectedDate = new Date(req.expected_check_out)
              const today = new Date()
              const daysUntilVacate = Math.ceil((expectedDate - today) / (1000 * 60 * 60 * 24))
              const isPending = req.status === 'pending'
              return (
                <div key={req.id} className={`bg-white rounded-xl border p-4 ${daysUntilVacate <= 7 ? 'border-red-200 bg-red-50' : 'border-yellow-100'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${daysUntilVacate <= 7 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {req.status === 'approved' ? '✅ Approved' : (daysUntilVacate <= 7 ? `⚠️ ${daysUntilVacate} days left` : 'Pending')}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(req.requested_date)}</span>
                      </div>
                      <h3 className="font-semibold text-slate-800">{req.tenant_name}</h3>
                      <p className="text-sm text-gray-500">Room {req.room_number}</p>
                      <p className="text-sm text-gray-600 mt-1">Expected: {formatDate(req.expected_check_out)}</p>
                      {req.reason && <p className="text-sm text-gray-500 mt-1">Reason: {req.reason}</p>}
                    </div>
                    {isPending && (
                      <button onClick={() => approveVacateRequest(req.id, req.tenant_id, req.room_id)} className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-700 transition">Approve</button>
                    )}
                  </div>
                </div>
              )
            })}
            {vacateRequests.length === 0 && <div className="text-center py-12 bg-gray-50 rounded-xl"><div className="text-5xl mb-3">🚪</div><p className="text-gray-500">No vacate requests</p></div>}
          </div>
        )}

        {/* Applications Tab */}
        {activeTab === 'applications' && (
          <div className="space-y-4">
            {applications.map(app => (
              <div key={app.id} className="bg-white rounded-xl border border-gray-100 p-4 flex justify-between items-center hover:shadow-md transition cursor-pointer" onClick={() => { setSelectedApplication(app); setShowApplicationDetailModal(true) }}>
                <div>
                  <h3 className="font-semibold text-slate-800">{app.name}</h3>
                  <p className="text-sm text-gray-500">📞 {app.phone}</p>
                  {app.message && <p className="text-sm text-gray-600 mt-1">💬 {app.message}</p>}
                  <p className="text-xs text-gray-400 mt-1">Applied: {formatDate(app.created_at)}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); approveApplication(app.id) }} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition">Approve →</button>
              </div>
            ))}
            {applications.length === 0 && <div className="text-center py-12 bg-gray-50 rounded-xl"><div className="text-5xl mb-3">📋</div><p className="text-gray-500">No pending applications</p></div>}
          </div>
        )}

        {/* Notices Tab */}
        {activeTab === 'notices' && (
          <div className="space-y-4">
            <button onClick={() => setShowNoticeModal(true)} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold mb-4 hover:bg-slate-700 transition">+ Post New Notice</button>
            {notices.map(notice => (
              <div key={notice.id} className={`bg-white rounded-xl border p-4 ${notice.is_urgent ? 'border-red-200 bg-red-50' : 'border-gray-100'} relative group`}>
                <button onClick={() => deleteNotice(notice.id)} className="absolute top-4 right-4 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition">🗑️ Delete</button>
                <div className="flex items-center gap-2 mb-2 pr-12">
                  <h3 className="font-semibold text-slate-800">{notice.title}</h3>
                  {notice.is_urgent && <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs">URGENT</span>}
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">{notice.type}</span>
                </div>
                <p className="text-gray-600">{notice.content}</p>
                <p className="text-xs text-gray-400 mt-2">Posted: {formatDate(notice.created_at)}</p>
              </div>
            ))}
            {notices.length === 0 && <div className="text-center py-12 bg-gray-50 rounded-xl"><div className="text-5xl mb-3">📢</div><p className="text-gray-500">No notices posted yet</p><button onClick={() => setShowNoticeModal(true)} className="mt-3 text-slate-600 underline">Post your first notice</button></div>}
          </div>
        )}
      </div>

      {/* ========== MODALS ========== */}

      {/* Confirm Delete Modal */}
      <AnimatePresence>
        {showConfirmDeleteModal && tenantToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowConfirmDeleteModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4 text-red-600">⚠️ Delete Tenant</h2>
              <p className="text-gray-600 mb-4">Are you sure you want to delete <strong>{tenantToDelete.name}</strong>?</p>
              <div className="bg-yellow-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-yellow-800">This will permanently delete:</p>
                <ul className="text-xs text-yellow-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Tenant record from rooms</li>
                  <li>Payment history</li>
                  <li>Complaints filed</li>
                  <li>Vacate requests</li>
                  <li>User account (optional)</li>
                </ul>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => deleteTenantComplete(tenantToDelete.id, tenantToDelete.room_id, tenantToDelete.user_id)} disabled={isSubmitting} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">{isSubmitting ? 'Deleting...' : '🗑️ Delete Permanently'}</button>
                <button onClick={() => deleteTenantSoft(tenantToDelete.id, tenantToDelete.room_id)} disabled={isSubmitting} className="flex-1 bg-yellow-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">Remove from Room Only</button>
                <button onClick={() => setShowConfirmDeleteModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Tenant Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Add New Tenant</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Full Name *" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                <input type="tel" placeholder="Phone Number *" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} maxLength={10} />
                <input type="email" placeholder="Email Address * (required for login)" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                <input type="number" placeholder="Monthly Rent (₹) *" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.rent_amount} onChange={(e) => setFormData({...formData, rent_amount: e.target.value})} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Advance Months</label>
                    <input type="number" placeholder="Advance Months" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.advance_amount} onChange={(e) => setFormData({...formData, advance_amount: e.target.value})} min="0" />
                    <p className="text-xs text-gray-400 mt-1">0 = no advance, due immediately</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Joining Fee (₹)</label>
                    <input type="number" placeholder="Joining Fee (₹)" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.joining_fee} onChange={(e) => setFormData({...formData, joining_fee: e.target.value})} min="0" />
                  </div>
                </div>
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.room_id} onChange={(e) => setFormData({...formData, room_id: e.target.value})}>
                  <option value="">Select Room</option>
                  {rooms.filter(r => r.current_occupants < r.capacity).map(room => (
                    <option key={room.id} value={room.id}>Room {room.room_number} - {getSharingDetails(room.sharing_type)?.label} - ₹{formatCurrency(room.monthly_rent)}/month ({room.capacity - room.current_occupants} slots left)</option>
                  ))}
                </select>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-blue-700">📌 After adding, tenant will receive a password set email. They can login with their email and set a password.</p>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={addTenant} disabled={isSubmitting} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50">{isSubmitting ? 'Adding...' : 'Add Tenant'}</button>
                  <button onClick={() => setShowAddModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Room Modal */}
      <AnimatePresence>
        {showRoomModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRoomModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Add New Room</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Room Number *" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={roomForm.room_number} onChange={(e) => setRoomForm({...roomForm, room_number: e.target.value})} />
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={roomForm.sharing_type} onChange={(e) => { const selected = sharingTypes.find(t => t.value === e.target.value); setRoomForm({...roomForm, sharing_type: e.target.value, monthly_rent: selected.price}) }}>
                  {sharingTypes.map(type => <option key={type.value} value={type.value}>{type.label} {type.icon} - ₹{formatCurrency(type.price)}/month</option>)}
                </select>
                <input type="number" placeholder="Monthly Rent (₹) *" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={roomForm.monthly_rent} onChange={(e) => setRoomForm({...roomForm, monthly_rent: e.target.value})} />
                <div className="flex gap-3 mt-6">
                  <button onClick={addRoom} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold">Add Room</button>
                  <button onClick={() => setShowRoomModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Collect Rent Modal */}
      <AnimatePresence>
        {showPaymentModal && selectedTenant && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPaymentModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Collect Rent</h2>
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="font-semibold">{selectedTenant.name}</p>
                <p className="text-sm text-gray-500">Room {selectedTenant.room_number || getRoomNumberById(selectedTenant.room_id)}</p>
                <p>Monthly Rent: {formatCurrency(selectedTenant.rent_amount)}</p>
                <p className="text-red-500">Pending: {formatCurrency(selectedTenant.pending_amount || selectedTenant.rent_amount)}</p>
              </div>
              <input type="number" placeholder="Enter Amount (₹)" className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
              <div className="flex gap-3">
                <button onClick={collectRent} disabled={isSubmitting} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">{isSubmitting ? 'Processing...' : 'Collect'}</button>
                <button onClick={() => setShowPaymentModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Post Notice Modal */}
      <AnimatePresence>
        {showNoticeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNoticeModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Post Notice</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Title *" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={noticeForm.title} onChange={(e) => setNoticeForm({...noticeForm, title: e.target.value})} />
                <textarea placeholder="Content *" rows="4" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={noticeForm.content} onChange={(e) => setNoticeForm({...noticeForm, content: e.target.value})} />
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={noticeForm.type} onChange={(e) => setNoticeForm({...noticeForm, type: e.target.value})}>
                  <option value="general">General</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="payment">Payment</option>
                  <option value="event">Event</option>
                  <option value="emergency">Emergency</option>
                </select>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={noticeForm.is_urgent} onChange={(e) => setNoticeForm({...noticeForm, is_urgent: e.target.checked})} className="w-4 h-4" />
                  <span className="text-sm">Mark as Urgent</span>
                </label>
                <div className="flex gap-3 mt-6">
                  <button onClick={postNotice} disabled={isSubmitting} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50">{isSubmitting ? 'Posting...' : 'Post Notice'}</button>
                  <button onClick={() => setShowNoticeModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSettingsModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">⚙️ Property Settings</h2>
              <div className="space-y-4">
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Joining Fee (₹)</label><input type="number" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={settings.joining_fee} onChange={(e) => setSettings({...settings, joining_fee: parseInt(e.target.value) || 0})} min="0" /></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Advance Months Required (default for new tenants)</label><input type="number" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={settings.advance_months} onChange={(e) => setSettings({...settings, advance_months: parseInt(e.target.value) || 0})} min="0" max="12" /></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Alert Threshold (days before due)</label><input type="number" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={settings.due_day} onChange={(e) => setSettings({...settings, due_day: parseInt(e.target.value) || 5})} min="1" max="30" /></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Your UPI ID (for rent payments)</label><input type="text" className="w-full px-4 py-3 border border-gray-200 rounded-xl" placeholder="yourname@okhdfcbank" value={settings.upi_id} onChange={(e) => setSettings({...settings, upi_id: e.target.value})} /><p className="text-xs text-gray-400 mt-1">Tenants can pay to this UPI ID.</p></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">UPI Phone Number (optional)</label><input type="tel" className="w-full px-4 py-3 border border-gray-200 rounded-xl" placeholder="9876543210" value={settings.upi_phone} onChange={(e) => setSettings({...settings, upi_phone: e.target.value})} /><p className="text-xs text-gray-400 mt-1">If provided, tenants can also pay using this phone number as UPI ID.</p></div>
                <div className="flex gap-3 mt-6"><button onClick={saveSettings} disabled={isSubmitting} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Save Settings'}</button><button onClick={() => setShowSettingsModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button></div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Complaint Response Modal */}
      <AnimatePresence>
        {showComplaintResponseModal && selectedComplaint && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowComplaintResponseModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Respond to Complaint</h2>
              <p className="text-sm text-gray-500 mb-2">From: {selectedComplaint.tenant_name}</p>
              <p className="text-sm text-gray-600 mb-4">"{selectedComplaint.title}"</p>
              <textarea placeholder="Your response..." rows="4" className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4" value={complaintResponse} onChange={(e) => setComplaintResponse(e.target.value)} />
              <div className="flex gap-3"><button onClick={respondToComplaint} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold">Send Response</button><button onClick={() => setShowComplaintResponseModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button></div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Room Details Modal */}
      <AnimatePresence>
        {showRoomDetailsModal && selectedRoom && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRoomDetailsModal(false)}>
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold text-slate-800">Room {selectedRoom.room_number} Details</h2><button onClick={() => setShowRoomDetailsModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button></div>
              <div className="grid md:grid-cols-2 gap-6">
                <div><h3 className="font-semibold text-slate-800 mb-3">Room Information</h3><div className="space-y-2 text-sm"><div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Room Number:</span><span className="font-semibold text-slate-700">{selectedRoom.room_number}</span></div><div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Sharing Type:</span><span className="font-semibold text-slate-700">{getSharingDetails(selectedRoom.sharing_type)?.label}</span></div><div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Monthly Rent:</span><span className="font-semibold text-slate-700">{formatCurrency(selectedRoom.monthly_rent)}</span></div><div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Capacity:</span><span className="font-semibold text-slate-700">{selectedRoom.capacity} persons</span></div><div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Current Occupants:</span><span className="font-semibold text-slate-700">{selectedRoom.current_occupants}</span></div></div></div>
                <div><h3 className="font-semibold text-slate-800 mb-3">Current Residents</h3><div className="space-y-3">{getTenantsInRoom(selectedRoom.id).map(tenant => (<div key={tenant.id} className="bg-gray-50 rounded-lg p-3"><div className="flex justify-between items-start"><div><p className="font-semibold text-slate-800">{tenant.name}</p><p className="text-xs text-gray-500">📞 {tenant.phone}</p><p className="text-xs text-gray-500 mt-1">Move-in: {formatDate(tenant.move_in_date)}</p></div><div className="text-right"><p className="text-sm font-semibold text-slate-700">{formatCurrency(tenant.rent_amount)}/month</p><p className={`text-xs ${tenant.rent_status === 'paid' ? 'text-green-500' : 'text-red-500'}`}>{tenant.rent_status === 'paid' ? '✅ Paid' : '⚠️ Pending'}</p><div className="flex gap-1 mt-1"><button onClick={() => fetchTenantPayments(tenant)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">📜 History</button><button onClick={() => fetchTenantApplication(tenant)} className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700">👤 Profile</button></div></div></div></div>))}{getTenantsInRoom(selectedRoom.id).length === 0 && <p className="text-gray-400 text-center py-4">No residents currently</p>}</div></div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Membership Modal */}
      <AnimatePresence>
        {showMembershipModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowMembershipModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">✨ Choose Membership Plan</h2>
              <div className="space-y-3"><button onClick={() => initiateMembershipPayment('monthly', 499, 'Monthly')} disabled={membershipLoading} className="w-full p-4 border rounded-xl text-left hover:bg-gray-50 transition"><div className="font-bold text-lg">Monthly Plan</div><div className="text-sm text-gray-500">₹499 / month</div><div className="text-xs text-gray-400 mt-1">✓ Basic support</div><div className="text-xs text-gray-400">✓ Up to 50 tenants</div></button><button onClick={() => initiateMembershipPayment('yearly', 4999, 'Yearly')} disabled={membershipLoading} className="w-full p-4 border rounded-xl text-left hover:bg-gray-50 transition"><div className="font-bold text-lg">Yearly Plan</div><div className="text-sm text-gray-500">₹4,999 / year</div><div className="text-xs text-gray-400 mt-1">✓ Priority support</div><div className="text-xs text-gray-400">✓ Unlimited tenants</div><div className="text-xs text-gray-400">✓ Analytics dashboard</div></button></div>
              <button onClick={() => setShowMembershipModal(false)} className="w-full mt-4 py-2 text-gray-500 hover:text-gray-700 transition">Cancel</button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Confirmation Modal */}
      <AnimatePresence>
        {showPaymentConfirmModal && confirmingTenant && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPaymentConfirmModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Confirm Payment</h2>
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="font-semibold">{confirmingTenant.name}</p>
                <p className="text-sm text-gray-500">Room {confirmingTenant.room_number || getRoomNumberById(confirmingTenant.room_id)}</p>
                <p className="text-sm text-gray-500 mt-2">UPI Transaction ID: {confirmingTenant.upi_transaction_id || 'N/A'}</p>
                {confirmingTenant.payment_screenshot && (<div className="mt-2"><p className="text-xs text-gray-500 mb-1">Payment Screenshot:</p><button onClick={() => { setScreenshotUrl(confirmingTenant.payment_screenshot); setShowScreenshotModal(true); }}><img src={confirmingTenant.payment_screenshot} alt="Payment proof" className="w-full rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-80" /></button></div>)}
              </div>
              <div className="flex gap-3"><button onClick={() => confirmPayment(confirmingTenant.id)} disabled={isSubmitting} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">{isSubmitting ? 'Confirming...' : '✅ Confirm Payment'}</button><button onClick={() => setShowPaymentConfirmModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button></div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Application Detail Modal */}
      <AnimatePresence>
        {showApplicationDetailModal && selectedApplication && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowApplicationDetailModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Application Details</h2>
              <div className="space-y-2 text-sm"><p><strong>Name:</strong> {selectedApplication.name}</p><p><strong>Phone:</strong> {selectedApplication.phone}</p><p><strong>Email:</strong> {selectedApplication.email || 'N/A'}</p><p><strong>Message:</strong> {selectedApplication.message || 'None'}</p><p><strong>Applied:</strong> {formatDate(selectedApplication.created_at)}</p>{selectedApplication.id_proof && (<div className="mt-3"><p className="font-semibold mb-1">ID Proof:</p><img src={selectedApplication.id_proof} alt="ID Proof" className="w-full rounded-lg max-h-48 object-cover border" /></div>)}{selectedApplication.photo && (<div className="mt-3"><p className="font-semibold mb-1">Photo:</p><img src={selectedApplication.photo} alt="Applicant Photo" className="w-full rounded-lg max-h-48 object-cover border" /></div>)}</div>
              <div className="flex gap-3 mt-6"><button onClick={() => { setShowApplicationDetailModal(false); approveApplication(selectedApplication.id) }} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700">Approve</button><button onClick={() => setShowApplicationDetailModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-2 rounded-lg font-semibold">Close</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tenant Payment History Modal */}
      <AnimatePresence>
        {showTenantPaymentsModal && selectedTenantForPayments && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTenantPaymentsModal(false)}>
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold text-slate-800">Payment History – {selectedTenantForPayments.name}</h2><button onClick={() => setShowTenantPaymentsModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button></div>
              {tenantPayments.length === 0 ? <p className="text-center text-gray-500 py-8">No payment records found.</p> : <div className="space-y-4">{tenantPayments.map(pay => (<div key={pay.id} className="border rounded-xl p-4 bg-gray-50"><div className="flex justify-between items-start flex-wrap gap-2"><div><p className="font-semibold">{formatCurrency(pay.amount)}</p><p className="text-sm text-gray-500">Date: {formatDate(pay.payment_date)}</p><p className="text-sm text-gray-500">Method: {pay.payment_method}</p><p className="text-sm text-gray-500">Status: {pay.status}</p>{pay.upi_transaction_id && <p className="text-xs text-gray-400">UTR: {pay.upi_transaction_id}</p>}</div>{pay.payment_screenshot && (<div><button onClick={() => { setScreenshotUrl(pay.payment_screenshot); setShowScreenshotModal(true); }}><img src={pay.payment_screenshot} alt="Screenshot" className="w-24 h-24 object-cover rounded-lg border cursor-pointer hover:opacity-80" /></button></div>)}</div></div>))}</div>}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Tenant Profile Modal */}
      <AnimatePresence>
        {showTenantProfileModal && selectedProfileTenant && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTenantProfileModal(false)}>
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold text-slate-800">Tenant Profile</h2><button onClick={() => setShowTenantProfileModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button></div>
              {loadingProfile ? <div className="text-center py-8">Loading...</div> : <div className="space-y-4"><div className="flex justify-center">{tenantApplication?.photo ? <img src={tenantApplication.photo} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-slate-200" /> : <div className="w-32 h-32 rounded-full bg-slate-200 flex items-center justify-center text-4xl font-bold text-slate-500">{selectedProfileTenant.name?.charAt(0).toUpperCase()}</div>}</div><div className="border-t pt-4"><h3 className="font-semibold text-lg mb-2">Personal Information</h3><div className="space-y-2 text-sm"><p><strong>Name:</strong> {selectedProfileTenant.name}</p><p><strong>Phone:</strong> {selectedProfileTenant.phone}</p><p><strong>Email:</strong> {selectedProfileTenant.email || 'N/A'}</p><p><strong>Move-in Date:</strong> {formatDate(selectedProfileTenant.move_in_date)}</p><p><strong>Rent Amount:</strong> {formatCurrency(selectedProfileTenant.rent_amount)}</p><p><strong>Paid:</strong> {formatCurrency(selectedProfileTenant.total_paid || 0)}</p><p><strong>Pending:</strong> {formatCurrency(selectedProfileTenant.pending_amount || 0)}</p></div></div>{tenantApplication && (<div className="border-t pt-4"><h3 className="font-semibold text-lg mb-2">Documents (from Application)</h3><div className="space-y-3">{tenantApplication.id_proof && (<div><p className="text-sm font-medium">ID Proof:</p><button onClick={() => { setScreenshotUrl(tenantApplication.id_proof); setShowScreenshotModal(true); }} className="mt-1"><img src={tenantApplication.id_proof} alt="ID Proof" className="max-h-40 rounded border cursor-pointer hover:opacity-80" /></button></div>)}{tenantApplication.photo && (<div><p className="text-sm font-medium">Passport Photo:</p><button onClick={() => { setScreenshotUrl(tenantApplication.photo); setShowScreenshotModal(true); }}><img src={tenantApplication.photo} alt="Photo" className="max-h-40 rounded border cursor-pointer hover:opacity-80" /></button></div>)}</div></div>)}{!tenantApplication && (<div className="border-t pt-4 text-center text-gray-500">No application documents found. This tenant was added manually.</div>)}<div className="flex justify-end"><button onClick={() => setShowTenantProfileModal(false)} className="bg-slate-800 text-white px-4 py-2 rounded-lg">Close</button></div></div>}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Full‑screen Screenshot Modal */}
      <AnimatePresence>
        {showScreenshotModal && screenshotUrl && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={() => setShowScreenshotModal(false)}>
            <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowScreenshotModal(false)} className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300">✕</button>
              <img src={screenshotUrl} alt="Screenshot" className="w-full rounded-lg shadow-2xl" />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
