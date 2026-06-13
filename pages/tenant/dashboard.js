import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate, getSharingDetails } from '../../lib/utils'
import toast from 'react-hot-toast'

export default function TenantDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
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
  const [showUpiAppSelector, setShowUpiAppSelector] = useState(false)
  const [complaintForm, setComplaintForm] = useState({ title: '', description: '', priority: 'medium' })
  const [vacateForm, setVacateForm] = useState({ expected_date: '', reason: '', rating: 0, review: '' })
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [editProfile, setEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '' })
  const [ratingHover, setRatingHover] = useState(0)
  // UPI payment states
  const [ownerUpiId, setOwnerUpiId] = useState('')
  const [paymentScreenshot, setPaymentScreenshot] = useState(null)
  const [paymentTransactionId, setPaymentTransactionId] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)

  // UPI apps with their intent URLs
  const upiApps = [
    { name: 'Google Pay', package: 'com.google.android.apps.nbu.pay', scheme: 'tez://upi/pay', intent: `intent://upi/pay?pa=${ownerUpiId}&pn=HostelSet&am=${paymentAmount}&cu=INR#Intent;scheme=tez;package=com.google.android.apps.nbu.pay;end` },
    { name: 'PhonePe', package: 'com.phonepe.app', scheme: 'phonepe://pay', intent: `intent://pay?pa=${ownerUpiId}&pn=HostelSet&am=${paymentAmount}&cu=INR#Intent;scheme=phonepe;package=com.phonepe.app;end` },
    { name: 'Paytm', package: 'net.one97.paytm', scheme: 'paytmmp://pay', intent: `intent://pay?pa=${ownerUpiId}&pn=HostelSet&am=${paymentAmount}&cu=INR#Intent;scheme=paytmmp;package=net.one97.paytm;end` },
    { name: 'Amazon Pay', package: 'in.amazon.mShop.android.shopping', scheme: 'amazonpay://upi/pay', intent: `intent://upi/pay?pa=${ownerUpiId}&pn=HostelSet&am=${paymentAmount}&cu=INR#Intent;scheme=amazonpay;package=in.amazon.mShop.android.shopping;end` },
  ]

  // Helper to open a specific UPI app via intent
  const openUpiApp = (intentUrl) => {
    window.location.href = intentUrl
    setTimeout(() => {
      toast.error('Unable to open the app. Please copy the UPI ID and pay manually.', { duration: 8000 })
    }, 2000)
  }

  const copyUpiId = () => {
    navigator.clipboard.writeText(ownerUpiId)
    toast.success('UPI ID copied!')
  }

  // Calculate next due date
  const calculateNextDueDate = () => {
    if (!tenant) return null
    const joinDate = new Date(tenant.move_in_date)
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth()
    let nextDue = new Date(currentYear, currentMonth, joinDate.getDate())
    if (today > nextDue) {
      nextDue = new Date(currentYear, currentMonth + 1, joinDate.getDate())
    }
    return nextDue
  }

  // Rent due status
  const getRentStatus = () => {
    if (!tenant) return { status: 'loading', message: '', daysUntilDue: null, dueDate: null }
    const nextDueDate = calculateNextDueDate()
    const today = new Date()
    const daysUntilDue = Math.ceil((nextDueDate - today) / (1000 * 60 * 60 * 24))
    const isPaidThisMonth = tenant.last_payment_date &&
      new Date(tenant.last_payment_date) >= new Date(today.getFullYear(), today.getMonth(), 1)

    if ((tenant.pending_amount > 0 && tenant.pending_amount >= tenant.rent_amount) || (!isPaidThisMonth && tenant.pending_amount > 0)) {
      if (daysUntilDue < 0) {
        return { status: 'overdue', message: `Overdue by ${Math.abs(daysUntilDue)} days`, daysUntilDue, dueDate: nextDueDate, urgent: true }
      } else if (daysUntilDue <= 5) {
        return { status: 'due_soon', message: `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`, daysUntilDue, dueDate: nextDueDate, urgent: true }
      } else {
        return { status: 'pending', message: `Due on ${formatDate(nextDueDate)}`, daysUntilDue, dueDate: nextDueDate, urgent: false }
      }
    } else if (tenant.pending_amount > 0 && tenant.pending_amount < tenant.rent_amount) {
      return { status: 'partial', message: `Partial paid. Due: ${formatCurrency(tenant.pending_amount)}`, daysUntilDue: null, dueDate: null, urgent: false }
    }
    return { status: 'paid', message: `Next due on ${formatDate(nextDueDate)}`, daysUntilDue, dueDate: nextDueDate, urgent: false }
  }

  const refreshData = () => {
    loadTenantData(localStorage.getItem('userId'))
  }

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    const userRole = localStorage.getItem('userRole')
    const userId = localStorage.getItem('userId')
    if (!isLoggedIn || userRole !== 'tenant') {
      router.push('/login')
      return
    }
    loadTenantData(userId)
  }, [])

  const uploadFile = async (file, prefix) => {
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${file.name.split('.').pop()}`
    const { data, error } = await supabase.storage
      .from('tenant-documents')
      .upload(fileName, file, { cacheControl: '3600' })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('tenant-documents').getPublicUrl(fileName)
    return publicUrl
  }

  const submitPaymentWithProof = async () => {
    if (!paymentScreenshot) {
      toast.error('Please upload payment screenshot')
      return
    }
    setPaymentLoading(true)
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
      await refreshData()
    } catch (error) {
      console.error('Payment error:', error)
      toast.error('Failed to submit payment: ' + error.message)
    } finally {
      setPaymentLoading(false)
    }
  }

  const loadTenantData = async (userId) => {
    setLoading(true)
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
      setProfileForm({
        name: tenantData.name || '',
        phone: tenantData.phone || '',
        email: tenantData.email || ''
      })

      if (tenantData.property?.owner_upi_id) {
        setOwnerUpiId(tenantData.property.owner_upi_id)
      } else {
        const { data: settings } = await supabase
          .from('owner_settings')
          .select('upi_id')
          .eq('owner_id', tenantData.property?.owner_id)
          .maybeSingle()
        if (settings?.upi_id) setOwnerUpiId(settings.upi_id)
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
              setRoommateVacateAlert({
                name: roommate?.name || upcoming.tenant_name,
                daysLeft,
                date: upcoming.expected_check_out
              })
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
      setLoading(false)
    }
  }

  const updateProfile = async () => {
    if (!profileForm.name) {
      toast.error('Name is required')
      return
    }
    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: profileForm.name,
          phone: profileForm.phone,
          email: profileForm.email
        })
        .eq('id', tenant.id)
      if (error) throw error
      toast.success('Profile updated successfully!')
      setEditProfile(false)
      await refreshData()
    } catch (error) {
      toast.error('Failed to update profile')
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitComplaint = async () => {
    if (!complaintForm.title || !complaintForm.description) {
      toast.error('Please fill all fields')
      return
    }
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
      await refreshData()
    } catch (error) {
      console.error('Submit complaint error:', error)
      toast.error('Failed to submit complaint: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ✅ FIXED: Delete complaint (must work)
  const deleteComplaint = async (complaintId) => {
    if (!confirm('Delete this complaint? This action cannot be undone.')) return
    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('complaints')
        .delete()
        .eq('id', complaintId)
        .eq('tenant_id', tenant.id) // extra security
      if (error) throw error
      toast.success('Complaint deleted.')
      // Remove from local state immediately for better UX
      setComplaints(prev => prev.filter(c => c.id !== complaintId))
      // Also refresh to sync with server
      await refreshData()
    } catch (error) {
      console.error('Delete complaint error:', error)
      toast.error('Failed to delete complaint: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const requestVacate = async () => {
    if (!vacateForm.expected_date) {
      toast.error('Please select expected check-out date')
      return
    }
    if (vacateForm.rating === 0) {
      toast.error('Please rate your experience (1-5 stars) before submitting vacate request')
      return
    }
    setIsSubmitting(true)
    try {
      if (!tenant) throw new Error('Tenant data not loaded')
      if (!tenant.property_id) throw new Error('Property ID not found')
      if (!tenant.room_id) throw new Error('Room ID not found')
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
      await refreshData()
    } catch (error) {
      console.error('Vacate request error:', error)
      toast.error('Failed to submit vacate request: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Cancel vacate request (no 3‑day restriction, only check pre‑booking)
  const cancelVacateRequest = async () => {
    if (!existingVacateRequest) return

    // Check for approved pre‑booking on the same room
    const { data: preBooking, error: preError } = await supabase
      .from('pre_bookings')
      .select('id')
      .eq('room_id', tenant.room_id)
      .eq('status', 'approved')
      .maybeSingle()

    if (preError) console.error('Pre-booking check error:', preError)

    if (preBooking) {
      toast.error('Cannot cancel vacate – a pre‑booking has already been approved for this room.')
      return
    }

    if (!confirm('Cancel your vacate request? You will continue as a tenant.')) return

    setIsSubmitting(true)
    try {
      const { error: delError } = await supabase
        .from('check_out_requests')
        .delete()
        .eq('id', existingVacateRequest.id)
      if (delError) throw delError

      const { error: updateError } = await supabase
        .from('tenants')
        .update({ status: 'active', check_out_requested: false, notice_period_start: null, notice_period_end: null })
        .eq('id', tenant.id)
      if (updateError) throw updateError

      toast.success('Vacate request cancelled. You remain as an active tenant.')
      await refreshData()
    } catch (error) {
      console.error('Cancel vacate error:', error)
      toast.error('Failed to cancel request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = () => {
    localStorage.clear()
    toast.success('Logged out successfully')
    router.push('/')
  }

  const rentStatus = getRentStatus()
  const isUrgent = rentStatus.urgent && (rentStatus.status === 'due_soon' || rentStatus.status === 'overdue')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 px-6 py-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">🏠 HOSTELSET</h1>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Tenant</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowProfileModal(true)} className="flex items-center gap-2 text-gray-600 hover:text-slate-800 transition">
              <div className="w-8 h-8 bg-gradient-to-r from-slate-600 to-slate-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {tenant?.name?.charAt(0) || 'U'}
              </div>
              <span className="text-sm hidden md:inline">{tenant?.name}</span>
            </button>
            <button onClick={handleLogout} className="text-red-500 hover:text-red-600 transition">Logout</button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section with Rent Status */}
        <div className={`rounded-2xl p-6 mb-8 text-white ${rentStatus.status === 'overdue' ? 'bg-gradient-to-r from-red-600 to-red-500 animate-pulse' : rentStatus.status === 'due_soon' ? 'bg-gradient-to-r from-orange-500 to-orange-600 animate-pulse' : 'bg-gradient-to-r from-slate-800 to-slate-700'}`}>
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">Welcome back, {tenant?.name}! 👋</h2>
              <p className="text-white/80">Room {room?.room_number} • {getSharingDetails(room?.sharing_type)?.label}</p>
              <p className="text-white/70 text-sm mt-1">{property?.name}</p>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-semibold ${isUrgent ? 'bg-red-700 text-white animate-pulse' : 'bg-white/20'}`}>
              {rentStatus.message}
            </div>
          </div>
          {rentStatus.dueDate && isUrgent && (
            <div className="mt-4 text-center">
              <div className="inline-block bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg text-lg font-bold">
                ⚠️ Next due date: {formatDate(rentStatus.dueDate)} ⚠️
              </div>
            </div>
          )}
        </div>

        {/* Roommate Vacate Alert */}
        {roommateVacateAlert && (
          <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-6 rounded-lg shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xl">🚪</span>
              <div>
                <strong>Vacate Notice:</strong> {roommateVacateAlert.name} will vacate in <strong>{roommateVacateAlert.daysLeft}</strong> days (by {formatDate(roommateVacateAlert.date)}).
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">💰</div><div><p className="text-xs text-gray-500">Monthly Rent</p><p className="text-xl font-bold text-slate-800">{formatCurrency(tenant?.rent_amount)}</p></div></div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="flex items-center gap-3"><div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-xl">✅</div><div><p className="text-xs text-gray-500">Total Paid</p><p className="text-xl font-bold text-green-600">{formatCurrency(tenant?.total_paid || 0)}</p></div></div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="flex items-center gap-3"><div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-xl">⚠️</div><div><p className="text-xs text-gray-500">Pending Amount</p><p className="text-xl font-bold text-red-500">{formatCurrency(tenant?.pending_amount || 0)}</p></div></div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-xl">👥</div><div><p className="text-xs text-gray-500">Roommates</p><p className="text-xl font-bold text-slate-800">{roommates.length}</p></div></div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button onClick={() => setShowPaymentModal(true)} className="bg-green-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-green-700 transition shadow-sm flex items-center gap-2">💳 Pay Rent (UPI)</button>
          <button onClick={() => setShowComplaintModal(true)} className="border-2 border-orange-300 text-orange-700 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-orange-50 transition flex items-center gap-2">📝 Raise Complaint</button>
          {existingVacateRequest ? (
            <button onClick={cancelVacateRequest} className="border-2 border-yellow-500 text-yellow-700 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-yellow-50 transition flex items-center gap-2">
              ❌ Cancel Vacate Request
            </button>
          ) : (
            <button onClick={() => setShowVacateModal(true)} className="border-2 border-red-300 text-red-700 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-red-50 transition flex items-center gap-2">
              🚪 Request Vacate
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-gray-200 mb-6 gap-2">
          {['overview', 'roommates', 'notices', 'complaints', 'payments'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2 text-sm font-semibold capitalize transition-all rounded-t-lg ${activeTab === tab ? 'bg-slate-800 text-white' : 'text-gray-500 hover:text-slate-700 hover:bg-gray-50'}`}>
              {tab === 'overview' && '📊 Overview'}
              {tab === 'roommates' && `👥 Roommates (${roommates.length})`}
              {tab === 'notices' && `📢 Notices (${notices.length})`}
              {tab === 'complaints' && `🔧 My Complaints (${complaints.length})`}
              {tab === 'payments' && `💰 Payment History (${paymentHistory.length})`}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><span className="text-xl">🏠</span> Your Room Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Room Number:</span><span className="font-semibold text-slate-800">{room?.room_number}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Sharing Type:</span><span className="font-semibold text-slate-800">{getSharingDetails(room?.sharing_type)?.label}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Monthly Rent:</span><span className="font-semibold text-green-600">{formatCurrency(room?.monthly_rent)}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Move-in Date:</span><span className="text-slate-700">{formatDate(tenant?.move_in_date)}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Current Status:</span><span className={`px-2 py-1 rounded-full text-xs ${tenant?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{tenant?.status === 'active' ? 'Active' : 'Notice Period'}</span></div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><span className="text-xl">🏢</span> Property Information</h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Property Name:</span><span className="font-semibold text-slate-800">{property?.name}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Address:</span><span className="text-slate-700 text-right">{property?.address}, {property?.city}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Owner Name:</span><span className="text-slate-700">{owner?.full_name || 'Not provided'}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Owner Contact:</span><span className="text-slate-700 font-medium">{property?.contact_number || owner?.phone || 'Not provided'}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Roommates Tab */}
        {activeTab === 'roommates' && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><span className="text-xl">👥</span> Your Roommates <span className="text-xs text-gray-400 ml-2">(Same Room Only)</span></h3>
            {roommates.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {roommates.map((mate, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                    <div className="w-12 h-12 bg-gradient-to-r from-slate-600 to-slate-500 rounded-full flex items-center justify-center text-white text-lg font-bold">{mate.name.charAt(0)}</div>
                    <div><p className="font-semibold text-slate-800">{mate.name}</p><p className="text-xs text-gray-500">📞 {mate.phone}</p><p className="text-xs text-gray-400">Since {formatDate(mate.move_in_date)}</p></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12"><div className="text-5xl mb-3">👤</div><p className="text-gray-500">You're the only person in this room</p><p className="text-xs text-gray-400">Enjoy the privacy!</p></div>
            )}
          </div>
        )}

        {/* Notices Tab */}
        {activeTab === 'notices' && (
          <div className="space-y-4">
            {notices.map((notice) => (
              <div key={notice.id} className={`bg-white rounded-xl border p-5 shadow-sm hover:shadow-md transition ${notice.is_urgent ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                <div className="flex items-center gap-2 mb-3"><h3 className="font-semibold text-slate-800 text-lg">{notice.title}</h3>{notice.is_urgent && <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-semibold animate-pulse">URGENT</span>}<span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">{notice.type}</span></div>
                <p className="text-gray-600 mb-3">{notice.content}</p>
                <p className="text-xs text-gray-400">Posted: {formatDate(notice.created_at)}</p>
              </div>
            ))}
            {notices.length === 0 && (<div className="text-center py-12 bg-white rounded-xl border border-gray-100"><div className="text-5xl mb-3">📢</div><p className="text-gray-500">No notices yet</p></div>)}
          </div>
        )}

        {/* Complaints Tab – with delete button */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            {complaints.map((complaint) => (
              <div key={complaint.id} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition relative group">
                <button
                  onClick={() => deleteComplaint(complaint.id)}
                  className="absolute top-4 right-4 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                >
                  🗑️ Delete
                </button>
                <div className="flex justify-between items-start mb-3 pr-8">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-slate-800">{complaint.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        complaint.priority === 'high' ? 'bg-red-100 text-red-700' :
                        complaint.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {complaint.priority}
                      </span>
                    </div>
                    <p className="text-gray-600">{complaint.description}</p>
                    {complaint.admin_response && (
                      <div className="mt-3 p-3 bg-green-50 rounded-lg">
                        <p className="text-xs text-green-600 font-semibold mb-1">Owner's Response:</p>
                        <p className="text-sm text-gray-700">{complaint.admin_response}</p>
                      </div>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    complaint.status === 'open' ? 'bg-red-100 text-red-700' :
                    complaint.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {complaint.status === 'open' ? 'Open' : complaint.status === 'in_progress' ? 'In Progress' : 'Resolved'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">Submitted: {formatDate(complaint.created_at)}</p>
              </div>
            ))}
            {complaints.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                <div className="text-5xl mb-3">📝</div>
                <p className="text-gray-500">No complaints filed yet</p>
                <button onClick={() => setShowComplaintModal(true)} className="mt-3 text-slate-600 underline">Raise a complaint</button>
              </div>
            )}
          </div>
        )}

        {/* Payment History Tab */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Method</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(payment.payment_date)}</td>
                      <td className="px-4 py-3 font-semibold text-green-600">{formatCurrency(payment.amount)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 capitalize">{payment.payment_method}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          payment.status === 'success' ? 'bg-green-100 text-green-700' :
                          payment.status === 'payment_pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {payment.status === 'success' ? 'Success' : payment.status === 'payment_pending' ? 'Pending' : payment.status}
                        </span>
                      </td>
                    <tr>
                  ))}
                  {paymentHistory.length === 0 && (
                    <tr>
                      <td colSpan="4" className="text-center py-8 text-gray-500">No payment history yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal – with UPI app selector */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPaymentModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">💳 Pay Rent via UPI</h2>
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="font-semibold">{tenant?.name}</p>
                <p className="text-sm text-gray-500">Room {room?.room_number}</p>
                <p>Monthly Rent: {formatCurrency(tenant?.rent_amount)}</p>
                <p className="text-red-500">Pending: {formatCurrency(tenant?.pending_amount || tenant?.rent_amount)}</p>
              </div>
              {ownerUpiId ? (
                <>
                  <div className="bg-blue-50 p-3 rounded-lg mb-4">
                    <p className="text-sm font-semibold text-center mb-2">Owner UPI ID: <span className="font-mono">{ownerUpiId}</span></p>
                    <div className="flex justify-center gap-2 mb-3">
                      <button
                        onClick={() => setShowUpiAppSelector(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-green-700 transition"
                      >
                        Pay with UPI App
                      </button>
                      <button
                        onClick={copyUpiId}
                        className="bg-gray-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-gray-700 transition"
                      >
                        Copy UPI ID
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 text-center">After payment, upload screenshot below.</p>
                  </div>

                  {/* UPI App Selector Modal */}
                  <AnimatePresence>
                    {showUpiAppSelector && (
                      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowUpiAppSelector(false)}>
                        <div className="bg-white rounded-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
                          <h3 className="text-xl font-bold mb-4">Choose UPI App</h3>
                          <div className="space-y-2">
                            {upiApps.map((app) => (
                              <button
                                key={app.name}
                                onClick={() => {
                                  setShowUpiAppSelector(false)
                                  openUpiApp(app.intent)
                                }}
                                className="w-full text-left px-4 py-3 border rounded-xl hover:bg-gray-50 transition"
                              >
                                {app.name}
                              </button>
                            ))}
                            <button
                              onClick={copyUpiId}
                              className="w-full text-left px-4 py-3 border rounded-xl hover:bg-gray-50 transition text-blue-600"
                            >
                              Copy UPI ID (Manual Payment)
                            </button>
                          </div>
                          <button onClick={() => setShowUpiAppSelector(false)} className="w-full mt-4 text-center text-gray-500">Cancel</button>
                        </div>
                      </div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">UPI Transaction ID (optional)</label>
                      <input type="text" className="w-full px-4 py-3 border rounded-xl" value={paymentTransactionId} onChange={e => setPaymentTransactionId(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Payment Screenshot *</label>
                      <input type="file" accept="image/*" onChange={e => {
                        const file = e.target.files[0]
                        if (file) setPaymentScreenshot(file)
                      }} className="w-full" />
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800">
                      After payment, upload the screenshot and submit. Owner will verify.
                    </div>
                    <button
                      onClick={submitPaymentWithProof}
                      disabled={paymentLoading}
                      className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
                    >
                      {paymentLoading ? 'Submitting...' : 'Submit Payment Proof'}
                    </button>
                    <button onClick={() => setShowPaymentModal(false)} className="w-full text-center text-gray-500 text-sm">Cancel</button>
                  </div>
                </>
              ) : (
                <p className="text-red-500">Owner UPI ID not set. Please contact your owner.</p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Complaint Modal */}
      <AnimatePresence>
        {showComplaintModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowComplaintModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">📝 Raise Complaint</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Title" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={complaintForm.title} onChange={(e) => setComplaintForm({...complaintForm, title: e.target.value})} />
                <textarea placeholder="Description" rows="4" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={complaintForm.description} onChange={(e) => setComplaintForm({...complaintForm, description: e.target.value})} />
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={complaintForm.priority} onChange={(e) => setComplaintForm({...complaintForm, priority: e.target.value})}>
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <div className="flex gap-3 mt-6">
                  <button onClick={submitComplaint} disabled={isSubmitting} className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">{isSubmitting ? 'Submitting...' : 'Submit Complaint'}</button>
                  <button onClick={() => setShowComplaintModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Vacate Request Modal */}
      <AnimatePresence>
        {showVacateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowVacateModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">🚪 Request Vacate</h2>
              <div className="space-y-4">
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Expected Check-out Date *</label><input type="date" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={vacateForm.expected_date} onChange={(e) => setVacateForm({...vacateForm, expected_date: e.target.value})} min={new Date().toISOString().split('T')[0]} /></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Reason for vacating (optional)</label><textarea placeholder="e.g., Moving to another city, Found a better place, etc." rows="3" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={vacateForm.reason} onChange={(e) => setVacateForm({...vacateForm, reason: e.target.value})} /></div>
                <div className="bg-yellow-50 p-3 rounded-lg"><p className="text-xs text-yellow-700">⚠️ Please clear all pending dues before vacating</p>{tenant?.pending_amount > 0 && (<p className="text-xs text-red-600 mt-1">⚠️ You have pending dues: {formatCurrency(tenant.pending_amount)}</p>)}</div>
                <div className="bg-red-50 p-3 rounded-lg"><p className="text-xs text-red-600">⚠️ Once approved, you must vacate within 30 days</p></div>

                {/* Star Rating Section */}
                <div className="border-t pt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Rate your experience * (required)</label>
                  <div className="flex gap-1 mb-2">
                    {[1,2,3,4,5].map((star) => (
                      <button key={star} type="button" onClick={() => setVacateForm({...vacateForm, rating: star})} onMouseEnter={() => setRatingHover(star)} onMouseLeave={() => setRatingHover(0)} className="text-3xl focus:outline-none transition-transform hover:scale-110">
                        <span className={star <= (vacateForm.rating || ratingHover) ? 'text-yellow-500' : 'text-gray-300'}>★</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">Your rating helps other tenants find good PGs.</p>
                  <textarea placeholder="Optional review (e.g., Cleanliness, owner behavior, amenities)" rows="2" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={vacateForm.review} onChange={(e) => setVacateForm({...vacateForm, review: e.target.value})} />
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={requestVacate} disabled={isSubmitting || !vacateForm.expected_date || vacateForm.rating === 0} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                    {isSubmitting ? 'Submitting...' : 'Submit Request & Rating'}
                  </button>
                  <button onClick={() => setShowVacateModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowProfileModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold">👤 My Profile</h2><button onClick={() => setEditProfile(!editProfile)} className="text-slate-600 hover:text-slate-800 text-sm">{editProfile ? 'Cancel' : 'Edit'}</button></div>
              {!editProfile ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"><div className="w-16 h-16 bg-gradient-to-r from-slate-600 to-slate-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">{tenant?.name?.charAt(0) || 'U'}</div><div><p className="font-semibold text-slate-800">{tenant?.name}</p><p className="text-sm text-gray-500">Tenant</p></div></div>
                  <div className="space-y-3"><div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">📞 Phone:</span><span className="text-slate-700">{tenant?.phone}</span></div><div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">📧 Email:</span><span className="text-slate-700">{tenant?.email || 'Not provided'}</span></div><div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">🏠 Room:</span><span className="text-slate-700">{room?.room_number}</span></div><div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">📅 Joined:</span><span className="text-slate-700">{formatDate(tenant?.move_in_date)}</span></div></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <input type="text" placeholder="Full Name" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={profileForm.name} onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} />
                  <input type="tel" placeholder="Phone Number" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} />
                  <input type="email" placeholder="Email" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={profileForm.email} onChange={(e) => setProfileForm({...profileForm, email: e.target.value})} />
                  <div className="flex gap-3 mt-6"><button onClick={updateProfile} disabled={isSubmitting} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Save Changes'}</button><button onClick={() => setEditProfile(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button></div>
                </div>
              )}
              <button onClick={() => setShowProfileModal(false)} className="w-full mt-4 py-2 text-gray-500 hover:text-gray-700 transition">Close</button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
