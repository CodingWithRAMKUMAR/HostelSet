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
  const [roommates, setRoommates] = useState([])
  const [notices, setNotices] = useState([])
  const [complaints, setComplaints] = useState([])
  const [paymentHistory, setPaymentHistory] = useState([])
  const [existingVacateRequest, setExistingVacateRequest] = useState(null)
  const [showComplaintModal, setShowComplaintModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showVacateModal, setShowVacateModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [complaintForm, setComplaintForm] = useState({ title: '', description: '', priority: 'medium' })
  const [vacateForm, setVacateForm] = useState({ expected_date: '', reason: '' })
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [paymentOTP, setPaymentOTP] = useState('')
  const [showOTPModal, setShowOTPModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [editProfile, setEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '' })

  // Calculate next due date based on join date
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

  // Calculate rent due status
  const getRentStatus = () => {
    if (!tenant) return { status: 'loading', message: '', daysUntilDue: null }
    
    const nextDueDate = calculateNextDueDate()
    const today = new Date()
    const daysUntilDue = Math.ceil((nextDueDate - today) / (1000 * 60 * 60 * 24))
    const isPaidThisMonth = tenant.last_payment_date && 
      new Date(tenant.last_payment_date) >= new Date(today.getFullYear(), today.getMonth(), 1)
    
    if ((tenant.pending_amount > 0 && tenant.pending_amount >= tenant.rent_amount) || (!isPaidThisMonth && tenant.pending_amount > 0)) {
      if (daysUntilDue < 0) {
        return { status: 'overdue', message: `Overdue by ${Math.abs(daysUntilDue)} days`, daysUntilDue }
      } else if (daysUntilDue <= 5) {
        return { status: 'due_soon', message: `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`, daysUntilDue }
      } else {
        return { status: 'pending', message: `Due on ${formatDate(nextDueDate)}`, daysUntilDue }
      }
    } else if (tenant.pending_amount > 0 && tenant.pending_amount < tenant.rent_amount) {
      return { status: 'partial', message: `Partial paid. Due: ${formatCurrency(tenant.pending_amount)}`, daysUntilDue }
    }
    return { status: 'paid', message: `Next due on ${formatDate(nextDueDate)}`, daysUntilDue }
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

  const loadTenantData = async (userId) => {
    setLoading(true)
    try {
      // Get tenant details
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
      
      // Get roommates (other tenants in same room)
      if (tenantData.room_id) {
        const { data: roommatesData } = await supabase
          .from('tenants')
          .select('name, phone, email, move_in_date')
          .eq('room_id', tenantData.room_id)
          .neq('id', tenantData.id)
        setRoommates(roommatesData || [])
      }
      
      // Check for existing vacate request
      const { data: vacateData } = await supabase
        .from('check_out_requests')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .eq('status', 'pending')
        .maybeSingle()
      setExistingVacateRequest(vacateData)
      
      // Get notices for this property
      const { data: noticesData } = await supabase
        .from('notices')
        .select('*')
        .eq('property_id', tenantData.property_id)
        .order('created_at', { ascending: false })
        .limit(10)
      setNotices(noticesData || [])
      
      // Get tenant's complaints
      const { data: complaintsData } = await supabase
        .from('complaints')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .order('created_at', { ascending: false })
      setComplaints(complaintsData || [])
      
      // Get payment history
      const { data: paymentsData } = await supabase
        .from('payment_history')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .order('payment_date', { ascending: false })
      setPaymentHistory(paymentsData || [])
      
      // Check for due alerts
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
      await loadTenantData(localStorage.getItem('userId'))
      
    } catch (error) {
      console.error('Update profile error:', error)
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
      await loadTenantData(localStorage.getItem('userId'))
      
    } catch (error) {
      console.error('Submit complaint error:', error)
      toast.error('Failed to submit complaint')
    } finally {
      setIsSubmitting(false)
    }
  }

  const initiatePayment = () => {
    if (paymentAmount <= 0) {
      toast.error('Invalid payment amount')
      return
    }
    
    const maxAmount = tenant.pending_amount || tenant.rent_amount
    if (paymentAmount > maxAmount) {
      toast.error(`Amount exceeds pending: ₹${maxAmount.toLocaleString()}`)
      return
    }
    
    setShowPaymentModal(false)
    setShowOTPModal(true)
  }

  const verifyPaymentOTP = async () => {
    if (paymentOTP !== '123456') {
      toast.error('Invalid OTP. Demo OTP is: 123456')
      return
    }
    
    setIsSubmitting(true)
    try {
      // Insert payment record
      const { error: paymentError } = await supabase
        .from('payment_history')
        .insert({
          tenant_id: tenant.id,
          amount: paymentAmount,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: paymentMethod,
          status: 'success',
          transaction_id: `TXN_${Date.now()}`
        })
      
      if (paymentError) throw paymentError
      
      // Update tenant
      const newTotalPaid = (tenant.total_paid || 0) + paymentAmount
      const newPendingAmount = (tenant.pending_amount || tenant.rent_amount) - paymentAmount
      const newRentStatus = newPendingAmount <= 0 ? 'paid' : 'pending'
      
      const { error: updateError } = await supabase
        .from('tenants')
        .update({
          total_paid: newTotalPaid,
          pending_amount: Math.max(0, newPendingAmount),
          rent_status: newRentStatus,
          last_payment_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', tenant.id)
      
      if (updateError) throw updateError
      
      toast.success(`Payment of ₹${paymentAmount.toLocaleString()} successful!`)
      setShowOTPModal(false)
      setPaymentOTP('')
      await loadTenantData(localStorage.getItem('userId'))
      
    } catch (error) {
      console.error('Payment error:', error)
      toast.error('Payment failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const requestVacate = async () => {
    if (!vacateForm.expected_date) {
      toast.error('Please select expected check-out date')
      return
    }
    
    setIsSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('check_out_requests')
        .insert({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          property_id: tenant.property_id,
          room_id: tenant.room_id,
          room_number: room?.room_number,
          expected_check_out: vacateForm.expected_date,
          reason: vacateForm.reason || null,
          requested_date: new Date().toISOString().split('T')[0],
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
      
      if (error) throw error
      
      toast.success('Vacate request submitted! Owner will review it.')
      setShowVacateModal(false)
      setVacateForm({ expected_date: '', reason: '' })
      await loadTenantData(localStorage.getItem('userId'))
      
    } catch (error) {
      console.error('Vacate request error:', error)
      toast.error('Failed to submit vacate request: ' + error.message)
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
            <button 
              onClick={() => setShowProfileModal(true)} 
              className="flex items-center gap-2 text-gray-600 hover:text-slate-800 transition"
            >
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
        <div className={`bg-gradient-to-r rounded-2xl p-6 mb-8 text-white ${
          rentStatus.status === 'overdue' ? 'from-red-600 to-red-500' :
          rentStatus.status === 'due_soon' ? 'from-orange-600 to-orange-500' :
          rentStatus.status === 'pending' ? 'from-yellow-600 to-yellow-500' :
          rentStatus.status === 'partial' ? 'from-blue-600 to-blue-500' :
          'from-slate-800 to-slate-700'
        }`}>
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">Welcome back, {tenant?.name}! 👋</h2>
              <p className="text-white/80">Room {room?.room_number} • {getSharingDetails(room?.sharing_type)?.label}</p>
              <p className="text-white/70 text-sm mt-1">{property?.name}</p>
            </div>
            <div className="px-4 py-2 rounded-full text-sm font-semibold bg-white/20">
              {rentStatus.message}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">💰</div>
              <div>
                <p className="text-xs text-gray-500">Monthly Rent</p>
                <p className="text-xl font-bold text-slate-800">{formatCurrency(tenant?.rent_amount)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-xl">✅</div>
              <div>
                <p className="text-xs text-gray-500">Total Paid</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(tenant?.total_paid || 0)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-xl">⚠️</div>
              <div>
                <p className="text-xs text-gray-500">Pending Amount</p>
                <p className="text-xl font-bold text-red-500">{formatCurrency(tenant?.pending_amount || 0)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-xl">👥</div>
              <div>
                <p className="text-xs text-gray-500">Roommates</p>
                <p className="text-xl font-bold text-slate-800">{roommates.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button 
            onClick={() => setShowPaymentModal(true)} 
            className="bg-green-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-green-700 transition shadow-sm flex items-center gap-2"
          >
            💳 Pay Rent
          </button>
          <button 
            onClick={() => setShowComplaintModal(true)} 
            className="border-2 border-orange-300 text-orange-700 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-orange-50 transition flex items-center gap-2"
          >
            📝 Raise Complaint
          </button>
          <button 
            onClick={() => setShowVacateModal(true)} 
            disabled={existingVacateRequest !== null}
            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition flex items-center gap-2 ${
              existingVacateRequest 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'border-2 border-red-300 text-red-700 hover:bg-red-50'
            }`}
          >
            {existingVacateRequest ? '⏳ Vacate Request Pending' : '🚪 Request Vacate'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-gray-200 mb-6 gap-2">
          {['overview', 'roommates', 'notices', 'complaints', 'payments'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 text-sm font-semibold capitalize transition-all rounded-t-lg ${
                activeTab === tab ? 'bg-slate-800 text-white' : 'text-gray-500 hover:text-slate-700 hover:bg-gray-50'
              }`}
            >
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
            {/* Room Details */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <span className="text-xl">🏠</span> Your Room Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Room Number:</span>
                  <span className="font-semibold text-slate-800">{room?.room_number}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Sharing Type:</span>
                  <span className="font-semibold text-slate-800">{getSharingDetails(room?.sharing_type)?.label} {getSharingDetails(room?.sharing_type)?.icon}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Monthly Rent:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(room?.monthly_rent)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Move-in Date:</span>
                  <span className="text-slate-700">{formatDate(tenant?.move_in_date)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Current Status:</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    tenant?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {tenant?.status === 'active' ? 'Active' : 'Notice Period'}
                  </span>
                </div>
              </div>
            </div>

            {/* Property Info */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <span className="text-xl">🏢</span> Property Information
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Property Name:</span>
                  <span className="font-semibold text-slate-800">{property?.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Address:</span>
                  <span className="text-slate-700 text-right">{property?.address}, {property?.city}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Contact Number:</span>
                  <span className="text-slate-700">{property?.contact_number}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Total Rooms:</span>
                  <span className="text-slate-700">{property?.total_rooms || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Recent Payment */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition md:col-span-2">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <span className="text-xl">💰</span> Recent Payment
              </h3>
              {paymentHistory.length > 0 ? (
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-green-700">Last Payment</p>
                    <p className="text-xs text-gray-500">{formatDate(paymentHistory[0]?.payment_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{formatCurrency(paymentHistory[0]?.amount)}</p>
                    <p className="text-xs text-gray-500 capitalize">via {paymentHistory[0]?.payment_method}</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">No payment history yet</p>
              )}
            </div>
          </div>
        )}

        {/* Roommates Tab - ONLY SHOWS ROOMMATES IN SAME ROOM */}
        {activeTab === 'roommates' && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-xl">👥</span> Your Roommates
              <span className="text-xs text-gray-400 ml-2">(Same Room Only)</span>
            </h3>
            {roommates.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {roommates.map((mate, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
                  >
                    <div className="w-12 h-12 bg-gradient-to-r from-slate-600 to-slate-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
                      {mate.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{mate.name}</p>
                      <p className="text-xs text-gray-500">📞 {mate.phone}</p>
                      <p className="text-xs text-gray-400">Since {formatDate(mate.move_in_date)}</p>
                    </div>
                    {mate.email && (
                      <p className="text-xs text-gray-400">📧 {mate.email}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">👤</div>
                <p className="text-gray-500">You're the only person in this room</p>
                <p className="text-xs text-gray-400">Enjoy the privacy!</p>
              </div>
            )}
          </div>
        )}

        {/* Notices Tab */}
        {activeTab === 'notices' && (
          <div className="space-y-4">
            {notices.map((notice, idx) => (
              <motion.div
                key={notice.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`bg-white rounded-xl border p-5 shadow-sm hover:shadow-md transition ${
                  notice.is_urgent ? 'border-red-200 bg-red-50' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold text-slate-800 text-lg">{notice.title}</h3>
                  {notice.is_urgent && (
                    <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-semibold animate-pulse">URGENT</span>
                  )}
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">{notice.type}</span>
                </div>
                <p className="text-gray-600 mb-3 leading-relaxed">{notice.content}</p>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-400">Posted: {formatDate(notice.created_at)}</p>
                  {notice.is_urgent && (
                    <p className="text-xs text-red-500">⚠️ Action required</p>
                  )}
                </div>
              </motion.div>
            ))}
            {notices.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                <div className="text-5xl mb-3">📢</div>
                <p className="text-gray-500">No notices yet</p>
                <p className="text-xs text-gray-400">Check back later for updates from owner</p>
              </div>
            )}
          </div>
        )}

        {/* Complaints Tab */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            {complaints.map((complaint, idx) => (
              <motion.div
                key={complaint.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-slate-800">{complaint.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        complaint.priority === 'high' ? 'bg-red-100 text-red-700' :
                        complaint.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {complaint.priority?.toUpperCase() || 'MEDIUM'}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-3">{complaint.description}</p>
                    {complaint.admin_response && (
                      <div className="mt-3 p-3 bg-green-50 rounded-lg">
                        <p className="text-xs text-green-600 font-semibold mb-1">📝 Owner's Response:</p>
                        <p className="text-sm text-gray-700">{complaint.admin_response}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(complaint.responded_at)}</p>
                      </div>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ml-3 ${
                    complaint.status === 'open' ? 'bg-red-100 text-red-700' :
                    complaint.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {complaint.status === 'open' ? 'Open' : complaint.status === 'in_progress' ? 'In Progress' : 'Resolved'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">Submitted: {formatDate(complaint.created_at)}</p>
              </motion.div>
            ))}
            {complaints.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                <div className="text-5xl mb-3">📝</div>
                <p className="text-gray-500">No complaints filed yet</p>
                <button 
                  onClick={() => setShowComplaintModal(true)} 
                  className="mt-3 text-slate-600 underline hover:text-slate-800 transition"
                >
                  Raise a complaint
                </button>
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
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Transaction ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(payment.payment_date)}</td>
                      <td className="px-4 py-3 font-semibold text-green-600">{formatCurrency(payment.amount)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 capitalize">{payment.payment_method}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{payment.transaction_id || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Success</span>
                      </td>
                    </tr>
                  ))}
                  {paymentHistory.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center py-8 text-gray-500">
                        <div className="text-4xl mb-2">💳</div>
                        No payment history yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPaymentModal(false)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4">💳 Pay Rent</h2>
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="font-semibold">{tenant?.name}</p>
                <p className="text-sm text-gray-500">Room {room?.room_number}</p>
                <p>Monthly Rent: {formatCurrency(tenant?.rent_amount)}</p>
                <p className="text-red-500">Pending: {formatCurrency(tenant?.pending_amount || tenant?.rent_amount)}</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (₹)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    value={paymentAmount} 
                    onChange={(e) => setPaymentAmount(parseInt(e.target.value))} 
                    max={tenant?.pending_amount || tenant?.rent_amount}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['card', 'upi', 'netbanking'].map((method) => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`px-3 py-2 rounded-lg text-sm capitalize transition ${
                          paymentMethod === method
                            ? 'bg-slate-800 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {method === 'card' ? '💳 Card' : method === 'upi' ? '📱 UPI' : '🏦 NetBanking'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <p className="text-xs text-yellow-700">💡 Demo Mode: Use OTP <strong className="text-sm">123456</strong></p>
                </div>
                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={initiatePayment} 
                    className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition"
                  >
                    Proceed to Pay
                  </button>
                  <button 
                    onClick={() => setShowPaymentModal(false)} 
                    className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OTP Modal */}
      <AnimatePresence>
        {showOTPModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowOTPModal(false)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4">🔐 Verify Payment</h2>
              <p className="text-gray-600 mb-4">Enter OTP sent to your registered mobile number</p>
              <div className="bg-blue-50 p-3 rounded-lg mb-4">
                <p className="text-xs text-blue-700 text-center">Demo OTP: <strong className="text-lg">123456</strong></p>
              </div>
              <input 
                type="text" 
                placeholder="Enter OTP" 
                className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4 text-center text-2xl tracking-widest focus:ring-2 focus:ring-slate-500"
                value={paymentOTP} 
                onChange={(e) => setPaymentOTP(e.target.value)} 
                maxLength={6}
              />
              <div className="flex gap-3">
                <button 
                  onClick={verifyPaymentOTP} 
                  disabled={isSubmitting} 
                  className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 hover:bg-green-700 transition"
                >
                  {isSubmitting ? 'Verifying...' : 'Verify & Pay'}
                </button>
                <button 
                  onClick={() => setShowOTPModal(false)} 
                  className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Complaint Modal */}
      <AnimatePresence>
        {showComplaintModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowComplaintModal(false)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4">📝 Raise Complaint</h2>
              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Title" 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-500"
                  value={complaintForm.title} 
                  onChange={(e) => setComplaintForm({...complaintForm, title: e.target.value})} 
                />
                <textarea 
                  placeholder="Description" 
                  rows="4" 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-500"
                  value={complaintForm.description} 
                  onChange={(e) => setComplaintForm({...complaintForm, description: e.target.value})} 
                />
                <select 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-500"
                  value={complaintForm.priority} 
                  onChange={(e) => setComplaintForm({...complaintForm, priority: e.target.value})}
                >
                  <option value="low">🟢 Low Priority</option>
                  <option value="medium">🟡 Medium Priority</option>
                  <option value="high">🔴 High Priority</option>
                </select>
                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={submitComplaint} 
                    disabled={isSubmitting} 
                    className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 hover:bg-orange-700 transition"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Complaint'}
                  </button>
                  <button 
                    onClick={() => setShowComplaintModal(false)} 
                    className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
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
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4">🚪 Request Vacate</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Expected Check-out Date *</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-500" 
                    value={vacateForm.expected_date} 
                    onChange={(e) => setVacateForm({...vacateForm, expected_date: e.target.value})}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Reason for vacating (optional)</label>
                  <textarea 
                    placeholder="e.g., Moving to another city, Found a better place, etc." 
                    rows="3" 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-500" 
                    value={vacateForm.reason} 
                    onChange={(e) => setVacateForm({...vacateForm, reason: e.target.value})}
                  />
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <p className="text-xs text-yellow-700">⚠️ Please clear all pending dues before vacating</p>
                  {tenant?.pending_amount > 0 && (
                    <p className="text-xs text-red-600 mt-1">⚠️ You have pending dues: {formatCurrency(tenant.pending_amount)}</p>
                  )}
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-xs text-red-600">⚠️ Once approved, you must vacate within 30 days</p>
                </div>
                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={requestVacate} 
                    disabled={isSubmitting || !vacateForm.expected_date} 
                    className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 hover:bg-red-700 transition"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                  <button 
                    onClick={() => setShowVacateModal(false)} 
                    className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowProfileModal(false)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">👤 My Profile</h2>
                <button 
                  onClick={() => setEditProfile(!editProfile)} 
                  className="text-slate-600 hover:text-slate-800 text-sm"
                >
                  {editProfile ? 'Cancel' : 'Edit'}
                </button>
              </div>
              
              {!editProfile ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="w-16 h-16 bg-gradient-to-r from-slate-600 to-slate-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                      {tenant?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{tenant?.name}</p>
                      <p className="text-sm text-gray-500">Tenant</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-500">📞 Phone:</span>
                      <span className="text-slate-700">{tenant?.phone}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-500">📧 Email:</span>
                      <span className="text-slate-700">{tenant?.email || 'Not provided'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-500">🏠 Room:</span>
                      <span className="text-slate-700">{room?.room_number}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-500">📅 Joined:</span>
                      <span className="text-slate-700">{formatDate(tenant?.move_in_date)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="Full Name" 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-500"
                    value={profileForm.name} 
                    onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                  />
                  <input 
                    type="tel" 
                    placeholder="Phone Number" 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-500"
                    value={profileForm.phone} 
                    onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                  />
                  <input 
                    type="email" 
                    placeholder="Email" 
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-500"
                    value={profileForm.email} 
                    onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                  />
                  <div className="flex gap-3 mt-6">
                    <button 
                      onClick={updateProfile} 
                      disabled={isSubmitting} 
                      className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50 hover:bg-slate-700 transition"
                    >
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button 
                      onClick={() => setEditProfile(false)} 
                      className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              <button 
                onClick={() => setShowProfileModal(false)} 
                className="w-full mt-4 py-2 text-gray-500 hover:text-gray-700 transition"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
