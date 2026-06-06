import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
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
  const [showComplaintModal, setShowComplaintModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showVacateModal, setShowVacateModal] = useState(false)
  const [complaintForm, setComplaintForm] = useState({ title: '', description: '', priority: 'medium' })
  const [vacateForm, setVacateForm] = useState({ expected_date: '', reason: '' })
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [paymentOTP, setPaymentOTP] = useState('')
  const [showOTPModal, setShowOTPModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

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
      
      // Get roommates (other tenants in same room)
      if (tenantData.room_id) {
        const { data: roommatesData } = await supabase
          .from('tenants')
          .select('name, phone, email, move_in_date')
          .eq('room_id', tenantData.room_id)
          .neq('id', tenantData.id)
        setRoommates(roommatesData || [])
      }
      
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
      
    } catch (error) {
      console.error('Load tenant data error:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
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
      
      toast.success('✅ Complaint submitted successfully!')
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

  // Demo Payment Integration
  const initiatePayment = () => {
    if (paymentAmount <= 0) {
      toast.error('Invalid payment amount')
      return
    }
    
    if (paymentAmount > (tenant.pending_amount || tenant.rent_amount)) {
      toast.error(`Amount exceeds pending: ₹${(tenant.pending_amount || tenant.rent_amount).toLocaleString()}`)
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
      
      // Update tenant's payment status
      const newTotalPaid = (tenant.total_paid || 0) + paymentAmount
      const newPendingAmount = (tenant.pending_amount || tenant.rent_amount) - paymentAmount
      const newRentStatus = newPendingAmount <= 0 ? 'paid' : 'pending'
      
      const { error: updateError } = await supabase
        .from('tenants')
        .update({
          total_paid: newTotalPaid,
          pending_amount: newPendingAmount,
          rent_status: newRentStatus,
          last_payment_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', tenant.id)
      
      if (updateError) throw updateError
      
      toast.success(`✅ Payment of ₹${paymentAmount.toLocaleString()} successful!`)
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
      const { error } = await supabase
        .from('check_out_requests')
        .insert({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          room_id: tenant.room_id,
          room_number: room?.room_number,
          property_id: tenant.property_id,
          expected_check_out: vacateForm.expected_date,
          reason: vacateForm.reason,
          requested_date: new Date().toISOString().split('T')[0],
          status: 'pending'
        })
      
      if (error) throw error
      
      toast.success('✅ Vacate request submitted! Owner will review it.')
      setShowVacateModal(false)
      setVacateForm({ expected_date: '', reason: '' })
      
    } catch (error) {
      console.error('Vacate request error:', error)
      toast.error('Failed to submit vacate request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = () => {
    localStorage.clear()
    toast.success('Logged out successfully')
    router.push('/')
  }

  const getDueDaysStatus = () => {
    if (!tenant?.last_payment_date) return { status: 'warning', message: 'First payment pending' }
    
    const lastPayment = new Date(tenant.last_payment_date)
    const today = new Date()
    const daysSincePayment = Math.floor((today - lastPayment) / (1000 * 60 * 60 * 24))
    
    if (tenant.pending_amount <= 0) return { status: 'success', message: 'All paid up! ✅' }
    if (daysSincePayment >= 30) return { status: 'danger', message: `Overdue by ${daysSincePayment - 30} days! ⚠️` }
    if (daysSincePayment >= 25) return { status: 'warning', message: `Due in ${30 - daysSincePayment} days` }
    return { status: 'info', message: `Next payment due in ${30 - daysSincePayment} days` }
  }

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

  const dueStatus = getDueDaysStatus()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 px-6 py-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              🏠 HOSTELSET
            </h1>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Tenant</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm hidden md:inline text-gray-600">{tenant?.name}</span>
            <button onClick={handleLogout} className="text-red-500 hover:text-red-600 transition">Logout</button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-6 mb-8 text-white">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">Welcome back, {tenant?.name}! 👋</h2>
              <p className="text-slate-300">Room {room?.room_number} • {getSharingDetails(room?.sharing_type)?.label}</p>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
              dueStatus.status === 'danger' ? 'bg-red-500' :
              dueStatus.status === 'warning' ? 'bg-yellow-500' :
              dueStatus.status === 'success' ? 'bg-green-500' : 'bg-blue-500'
            }`}>
              {dueStatus.message}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">💰</div>
              <div>
                <p className="text-xs text-gray-500">Monthly Rent</p>
                <p className="text-xl font-bold text-slate-800">{formatCurrency(tenant?.rent_amount)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-xl">✅</div>
              <div>
                <p className="text-xs text-gray-500">Total Paid</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(tenant?.total_paid || 0)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-xl">⚠️</div>
              <div>
                <p className="text-xs text-gray-500">Pending Amount</p>
                <p className="text-xl font-bold text-red-500">{formatCurrency(tenant?.pending_amount || tenant?.rent_amount || 0)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
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
            className="bg-green-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-green-700 transition shadow-sm"
          >
            💳 Pay Rent
          </button>
          <button 
            onClick={() => setShowComplaintModal(true)} 
            className="border-2 border-orange-300 text-orange-700 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-orange-50 transition"
          >
            📝 Raise Complaint
          </button>
          <button 
            onClick={() => setShowVacateModal(true)} 
            className="border-2 border-red-300 text-red-700 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-red-50 transition"
          >
            🚪 Request Vacate
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-gray-200 mb-6 gap-2">
          {['overview', 'roommates', 'notices', 'complaints', 'payments'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 text-sm font-semibold capitalize transition-all rounded-t-lg ${
                activeTab === tab ? 'bg-slate-800 text-white' : 'text-gray-500 hover:text-slate-700'
              }`}
            >
              {tab === 'overview' && '📊 Overview'}
              {tab === 'roommates' && '👥 Roommates'}
              {tab === 'notices' && '📢 Notices'}
              {tab === 'complaints' && '🔧 My Complaints'}
              {tab === 'payments' && '💰 Payment History'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Room Details */}
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <span>🏠</span> Your Room Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Room Number:</span>
                  <span className="font-semibold text-slate-800">{room?.room_number}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Sharing Type:</span>
                  <span className="font-semibold text-slate-800">{getSharingDetails(room?.sharing_type)?.label}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Monthly Rent:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(room?.monthly_rent)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Move-in Date:</span>
                  <span className="text-slate-700">{formatDate(tenant?.move_in_date)}</span>
                </div>
              </div>
            </div>

            {/* Property Info */}
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <span>🏢</span> Property Information
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
                  <span className="text-gray-500">Contact:</span>
                  <span className="text-slate-700">{property?.contact_number}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Roommates Tab - ONLY SHOWS ROOMMATES IN SAME ROOM */}
        {activeTab === 'roommates' && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span>👥</span> Your Roommates
            </h3>
            {roommates.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {roommates.map((mate, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="w-12 h-12 bg-gradient-to-r from-slate-600 to-slate-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
                      {mate.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{mate.name}</p>
                      <p className="text-xs text-gray-500">📞 {mate.phone}</p>
                      <p className="text-xs text-gray-400">Since {formatDate(mate.move_in_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
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
            {notices.map((notice) => (
              <div key={notice.id} className={`bg-white rounded-xl border p-5 ${notice.is_urgent ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold text-slate-800 text-lg">{notice.title}</h3>
                  {notice.is_urgent && (
                    <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs">URGENT</span>
                  )}
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">{notice.type}</span>
                </div>
                <p className="text-gray-600 mb-3">{notice.content}</p>
                <p className="text-xs text-gray-400">Posted: {formatDate(notice.created_at)}</p>
              </div>
            ))}
            {notices.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                <div className="text-5xl mb-3">📢</div>
                <p className="text-gray-500">No notices yet</p>
                <p className="text-xs text-gray-400">Check back later for updates</p>
              </div>
            )}
          </div>
        )}

        {/* Complaints Tab */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            {complaints.map((complaint) => (
              <div key={complaint.id} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
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
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
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
                  <tr key={payment.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(payment.payment_date)}</td>
                    <td className="px-4 py-3 font-semibold text-green-600">{formatCurrency(payment.amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 capitalize">{payment.payment_method}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Success</span>
                    </td>
                  </tr>
                ))}
                {paymentHistory.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-gray-500">No payment history yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPaymentModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl"
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
                        className={`px-3 py-2 rounded-lg text-sm capitalize ${
                          paymentMethod === method
                            ? 'bg-slate-800 text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <p className="text-xs text-yellow-700">💡 Demo Mode: Use OTP <strong>123456</strong></p>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={initiatePayment} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold">
                    Proceed to Pay
                  </button>
                  <button onClick={() => setShowPaymentModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* OTP Verification Modal */}
      <AnimatePresence>
        {showOTPModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowOTPModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">🔐 Verify Payment</h2>
              <p className="text-gray-600 mb-4">Enter OTP sent to your registered mobile number</p>
              <div className="bg-blue-50 p-3 rounded-lg mb-4">
                <p className="text-xs text-blue-700 text-center">Demo OTP: <strong className="text-lg">123456</strong></p>
              </div>
              <input
                type="text"
                placeholder="Enter OTP"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4 text-center text-2xl"
                value={paymentOTP}
                onChange={(e) => setPaymentOTP(e.target.value)}
                maxLength={6}
              />
              <div className="flex gap-3">
                <button onClick={verifyPaymentOTP} disabled={isSubmitting} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                  {isSubmitting ? 'Verifying...' : 'Verify & Pay'}
                </button>
                <button onClick={() => setShowOTPModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Complaint Modal */}
      <AnimatePresence>
        {showComplaintModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowComplaintModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">📝 Raise Complaint</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Title"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                  value={complaintForm.title}
                  onChange={(e) => setComplaintForm({...complaintForm, title: e.target.value})}
                />
                <textarea
                  placeholder="Description"
                  rows="4"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                  value={complaintForm.description}
                  onChange={(e) => setComplaintForm({...complaintForm, description: e.target.value})}
                />
                <select
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                  value={complaintForm.priority}
                  onChange={(e) => setComplaintForm({...complaintForm, priority: e.target.value})}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <div className="flex gap-3 mt-6">
                  <button onClick={submitComplaint} disabled={isSubmitting} className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                    {isSubmitting ? 'Submitting...' : 'Submit Complaint'}
                  </button>
                  <button onClick={() => setShowComplaintModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Vacate Request Modal */}
      <AnimatePresence>
        {showVacateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowVacateModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">🚪 Request Vacate</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Expected Check-out Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                    value={vacateForm.expected_date}
                    onChange={(e) => setVacateForm({...vacateForm, expected_date: e.target.value})}
                  />
                </div>
                <textarea
                  placeholder="Reason for vacating (optional)"
                  rows="3"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl"
                  value={vacateForm.reason}
                  onChange={(e) => setVacateForm({...vacateForm, reason: e.target.value})}
                />
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <p className="text-xs text-yellow-700">⚠️ Please clear all pending dues before vacating</p>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={requestVacate} disabled={isSubmitting} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                  <button onClick={() => setShowVacateModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
