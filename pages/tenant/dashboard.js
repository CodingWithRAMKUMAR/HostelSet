import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate, getDaysOverdue, getSharingDetails } from '../../lib/utils'
import toast from 'react-hot-toast'

export default function TenantDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tenant, setTenant] = useState(null)
  const [property, setProperty] = useState(null)
  const [room, setRoom] = useState(null)
  const [paymentHistory, setPaymentHistory] = useState([])
  const [complaints, setComplaints] = useState([])
  const [notices, setNotices] = useState([])
  const [checkOutRequest, setCheckOutRequest] = useState(null)
  const [showComplaintModal, setShowComplaintModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [complaintForm, setComplaintForm] = useState({ title: '', description: '', category: 'other' })
  const [paymentAmount, setPaymentAmount] = useState('')
  const [checkoutForm, setCheckoutForm] = useState({ expected_date: '', reason: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    const userRole = localStorage.getItem('userRole')
    console.log('Tenant Dashboard - Auth check:', { isLoggedIn, userRole })
    
    if (!isLoggedIn || userRole !== 'tenant') { 
      router.push('/login')
      return 
    }
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const userPhone = localStorage.getItem('userPhone')
      const userId = localStorage.getItem('userId')
      
      console.log('Looking for tenant with phone:', userPhone)
      console.log('Looking for tenant with userId:', userId)
      
      // Try to find tenant by phone number (most reliable)
      let tenantData = null
      
      if (userPhone) {
        const { data, error } = await supabase
          .from('tenants')
          .select('*')
          .eq('phone', userPhone)
          .maybeSingle()
        
        if (!error && data) {
          tenantData = data
          console.log('Found tenant by phone:', tenantData)
        }
      }
      
      // If not found by phone, try by user_id
      if (!tenantData && userId) {
        const { data, error } = await supabase
          .from('tenants')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()
        
        if (!error && data) {
          tenantData = data
          console.log('Found tenant by user_id:', tenantData)
        }
      }

      if (tenantData && tenantData.room_id) {
        setTenant(tenantData)
        
        // Get room details
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', tenantData.room_id)
          .single()
        
        console.log('Room data:', roomData)
        
        if (roomData) {
          setRoom(roomData)
        }
        
        // Get property details
        const { data: propertyData, error: propertyError } = await supabase
          .from('properties')
          .select('*')
          .eq('id', tenantData.property_id)
          .single()
        
        console.log('Property data:', propertyData)
        
        if (propertyData) {
          setProperty(propertyData)
        }

        // Get payment history
        const { data: payments } = await supabase
          .from('payment_history')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .order('payment_date', { ascending: false })
        setPaymentHistory(payments || [])

        // Get complaints
        const { data: complaintsData } = await supabase
          .from('complaints')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .order('created_at', { ascending: false })
        setComplaints(complaintsData || [])

        // Get notices
        const { data: noticesData } = await supabase
          .from('notices')
          .select('*')
          .eq('property_id', tenantData.property_id)
          .order('created_at', { ascending: false })
        setNotices(noticesData || [])

        // Get check-out request
        const { data: checkOutData } = await supabase
          .from('check_out_requests')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .order('created_at', { ascending: false })
          .limit(1)
        setCheckOutRequest(checkOutData?.[0] || null)
        
      } else {
        console.log('No tenant found or no room assigned. tenantData:', tenantData)
      }
    } catch (error) { 
      console.error('Error in loadData:', error)
      toast.error('Failed to load data: ' + error.message)
    } finally { 
      setLoading(false) 
    }
  }

  const raiseComplaint = async () => {
    if (!complaintForm.title || !complaintForm.description) { 
      toast.error('Fill all fields')
      return 
    }
    setIsSubmitting(true)
    try {
      await supabase.from('complaints').insert({ 
        tenant_id: tenant.id, 
        tenant_name: tenant.name, 
        room_number: room?.room_number, 
        title: complaintForm.title, 
        description: complaintForm.description, 
        category: complaintForm.category, 
        status: 'open' 
      })
      toast.success('Complaint raised!')
      setShowComplaintModal(false)
      setComplaintForm({ title: '', description: '', category: 'other' })
      await loadData()
    } catch (error) { 
      toast.error('Failed to raise complaint')
    } finally { 
      setIsSubmitting(false) 
    }
  }

  const requestCheckout = async () => {
    if (!checkoutForm.expected_date) { 
      toast.error('Select expected date')
      return 
    }
    setIsSubmitting(true)
    try {
      await supabase.from('check_out_requests').insert({ 
        tenant_id: tenant.id, 
        tenant_name: tenant.name, 
        room_number: room?.room_number, 
        expected_check_out: checkoutForm.expected_date, 
        reason: checkoutForm.reason, 
        notice_period_days: 30, 
        status: 'pending' 
      })
      toast.success('Request submitted!')
      setShowCheckoutModal(false)
      setCheckoutForm({ expected_date: '', reason: '' })
      await loadData()
    } catch (error) { 
      toast.error('Failed to submit request')
    } finally { 
      setIsSubmitting(false) 
    }
  }

  const payRent = async () => {
    if (!paymentAmount || parseInt(paymentAmount) <= 0) { 
      toast.error('Enter valid amount')
      return 
    }
    const amount = parseInt(paymentAmount)
    const maxAmount = tenant.pending_amount || tenant.rent_amount
    if (amount > maxAmount) { 
      toast.error(`Amount exceeds pending: ₹${maxAmount.toLocaleString()}`)
      return 
    }
    setIsSubmitting(true)
    try {
      await supabase.from('payment_history').insert({ 
        tenant_id: tenant.id, 
        amount, 
        payment_date: new Date().toISOString().split('T')[0], 
        payment_method: 'online', 
        status: 'success' 
      })
      const newTotalPaid = (tenant.total_paid || 0) + amount
      const newPendingAmount = maxAmount - amount
      await supabase.from('tenants').update({ 
        total_paid: newTotalPaid, 
        pending_amount: newPendingAmount, 
        rent_status: newPendingAmount <= 0 ? 'paid' : 'pending', 
        last_payment_date: new Date().toISOString().split('T')[0] 
      }).eq('id', tenant.id)
      toast.success(`Payment of ₹${amount.toLocaleString()} successful!`)
      setShowPayModal(false)
      setPaymentAmount('')
      await loadData()
    } catch (error) { 
      toast.error('Payment failed')
    } finally { 
      setIsSubmitting(false) 
    }
  }

  const handleLogout = () => { 
    localStorage.clear()
    router.push('/') 
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  // WAITING PAGE - Show this if tenant has NO room assigned
  if (!tenant || !tenant.room_id || !room) {
    return (
      <div className="min-h-screen" style={{ background: '#0f172a' }}>
        <nav className="navbar py-4 px-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">🏠 HOSTELSET</h1>
          <button onClick={handleLogout} className="text-red-500 hover:text-red-700">Logout</button>
        </nav>
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-6 animate-float">⏳</div>
            <h1 className="text-2xl font-bold text-white mb-2">Waiting for Room Assignment</h1>
            <p className="text-gray-400 mb-4">Your tenant account has been created successfully!</p>
            <p className="text-gray-400 mb-6">Please wait for the PG owner to assign you a room.</p>
            <div className="bg-yellow-500/10 border border-yellow-500 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm text-yellow-400">📌 Debug Info:</p>
              <ul className="text-sm text-gray-400 mt-2 space-y-1">
                <li>• Phone: {localStorage.getItem('userPhone') || 'Not found'}</li>
                <li>• User ID: {localStorage.getItem('userId') || 'Not found'}</li>
                <li>• Contact your PG owner to assign a room</li>
              </ul>
            </div>
            <button onClick={handleLogout} className="btn-primary w-full">Logout</button>
          </div>
        </div>
      </div>
    )
  }

  const sharingDetails = getSharingDetails(room?.sharing_type)
  const pendingAmount = tenant.pending_amount || tenant.rent_amount
  const isRentDue = pendingAmount > 0
  const dueDate = new Date(tenant.move_in_date)
  dueDate.setDate(property?.rent_due_day || 5)
  const daysOverdue = getDaysOverdue(dueDate)

  return (
    <div className="min-h-screen" style={{ background: '#0f172a' }}>
      <nav className="navbar py-4 px-6 flex justify-between items-center sticky top-0 z-50">
        <h1 className="text-2xl font-bold text-primary">🏠 HOSTELSET</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm hidden md:inline">Welcome, {tenant.name}</span>
          <button onClick={handleLogout} className="text-red-500 hover:text-red-700">Logout</button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h2 className="text-xl font-bold mb-4">🏠 My Room</h2>
            <p className="text-3xl font-bold text-primary">Room {room?.room_number}</p>
            <p className="text-gray-400 mt-2">{property?.name}</p>
            <p className="text-gray-500 text-sm">{property?.address}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-lg">{sharingDetails.icon}</span>
              <span className="text-gray-300">{sharingDetails.label}</span>
            </div>
            <p className="text-gray-500 text-sm mt-2">Joined: {formatDate(tenant.move_in_date)}</p>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold mb-4">💰 Rent Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Monthly Rent:</span>
                <span className="font-bold">{formatCurrency(tenant.rent_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Paid:</span>
                <span className="font-bold text-green-400">{formatCurrency(tenant.total_paid || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Pending:</span>
                <span className={`font-bold ${isRentDue ? 'text-red-400' : 'text-green-400'}`}>
                  {formatCurrency(pendingAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Due Date:</span>
                <span className="font-bold">Every {property?.rent_due_day || 5}th</span>
              </div>
              {daysOverdue > 0 && (
                <div className="alert-danger">
                  ⚠️ Overdue by {daysOverdue} days! Late fee applies.
                </div>
              )}
            </div>
            {isRentDue && (
              <button onClick={() => setShowPayModal(true)} className="btn-success w-full mt-4">
                Pay Rent Now →
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <button onClick={() => setShowComplaintModal(true)} className="card p-4 text-center font-semibold hover:-translate-y-1 transition">
            🔧 Raise Complaint
          </button>
          <button onClick={() => setShowCheckoutModal(true)} className="card p-4 text-center font-semibold hover:-translate-y-1 transition">
            🚪 Request Check-Out
          </button>
          <button className="card p-4 text-center font-semibold hover:-translate-y-1 transition">
            📢 View Notices
          </button>
        </div>

        {checkOutRequest && (
          <div className={`card p-4 mb-8 ${checkOutRequest.status === 'pending' ? 'alert-warning' : checkOutRequest.status === 'approved' ? 'alert-success' : 'alert-danger'}`}>
            <h3 className="font-bold mb-2">📋 Check-Out Request</h3>
            <p className="text-sm">Status: <span className="font-semibold">{checkOutRequest.status.toUpperCase()}</span></p>
            <p className="text-sm">Expected Date: {formatDate(checkOutRequest.expected_check_out)}</p>
            {checkOutRequest.owner_notes && <p className="text-sm mt-2 text-gray-400">Owner note: {checkOutRequest.owner_notes}</p>}
          </div>
        )}

        <div className="card p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">📜 Payment History</h2>
          {paymentHistory.length > 0 ? (
            paymentHistory.map(p => (
              <div key={p.id} className="flex justify-between items-center p-3 bg-dark rounded-lg mb-2">
                <div>
                  <p className="font-medium">{formatCurrency(p.amount)}</p>
                  <p className="text-xs text-gray-500">{formatDate(p.payment_date)}</p>
                </div>
                <div className="text-right">
                  <span className="badge-success">Success</span>
                  <p className="text-xs text-gray-500 mt-1">{p.payment_method}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">No payment history yet</div>
          )}
        </div>

        <div className="card p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">🔧 My Complaints</h2>
            <button onClick={() => setShowComplaintModal(true)} className="text-primary text-sm">+ New</button>
          </div>
          {complaints.length > 0 ? (
            complaints.map(c => (
              <div key={c.id} className="flex justify-between items-center p-3 bg-dark rounded-lg mb-2">
                <div>
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-xs text-gray-500">{formatDate(c.created_at)}</p>
                </div>
                <span className={`badge-${c.status === 'open' ? 'danger' : c.status === 'in_progress' ? 'warning' : 'success'}`}>
                  {c.status}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">No complaints yet</div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">📢 Notices</h2>
          {notices.length > 0 ? (
            notices.map(n => (
              <div key={n.id} className={`p-3 rounded-lg mb-2 ${n.is_urgent ? 'bg-red-500/10 border-l-4 border-red-500' : 'bg-dark'}`}>
                <p className="font-semibold">{n.title}</p>
                <p className="text-sm text-gray-400">{n.content}</p>
                <p className="text-xs text-gray-500 mt-1">{formatDate(n.created_at)}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">No notices yet</div>
          )}
        </div>
      </div>

      {showComplaintModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="text-2xl font-bold mb-4">Raise Complaint</h2>
            <div className="space-y-4">
              <input type="text" placeholder="Title" className="input" value={complaintForm.title} onChange={(e) => setComplaintForm({...complaintForm, title: e.target.value})} />
              <select className="input" value={complaintForm.category} onChange={(e) => setComplaintForm({...complaintForm, category: e.target.value})}>
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="cleaning">Cleaning</option>
                <option value="internet">Internet</option>
                <option value="other">Other</option>
              </select>
              <textarea placeholder="Description" rows="4" className="input" value={complaintForm.description} onChange={(e) => setComplaintForm({...complaintForm, description: e.target.value})} />
              <div className="flex gap-3 mt-6">
                <button onClick={raiseComplaint} className="btn-primary flex-1">Submit</button>
                <button onClick={() => setShowComplaintModal(false)} className="btn-outline flex-1">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPayModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="text-2xl font-bold mb-4 text-center">Pay Rent</h2>
            <div className="bg-dark rounded-xl p-4 mb-4">
              <p><strong>{tenant.name}</strong> - Room {room?.room_number}</p>
              <p>Monthly Rent: {formatCurrency(tenant.rent_amount)}</p>
              <p>Pending: {formatCurrency(pendingAmount)}</p>
            </div>
            <input type="number" placeholder="Enter Amount" className="input" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            <div className="bg-yellow-500/20 p-3 rounded-lg text-sm text-yellow-400 mt-4">
              💡 Demo payment. No real transaction.
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={payRent} className="btn-success flex-1">Pay Now</button>
              <button onClick={() => setShowPayModal(false)} className="btn-outline flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showCheckoutModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="text-2xl font-bold mb-4">Request Check-Out</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Expected Check-Out Date</label>
                <input type="date" className="input" value={checkoutForm.expected_date} onChange={(e) => setCheckoutForm({...checkoutForm, expected_date: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason (Optional)</label>
                <textarea placeholder="Why are you leaving?" rows="3" className="input" value={checkoutForm.reason} onChange={(e) => setCheckoutForm({...checkoutForm, reason: e.target.value})} />
              </div>
              <div className="alert-warning">
                <p className="font-semibold">⚠️ Notice Period: 30 days</p>
                <p className="text-xs mt-1">You will need to clear all pending dues before check-out.</p>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={requestCheckout} className="btn-primary flex-1">Submit Request</button>
                <button onClick={() => setShowCheckoutModal(false)} className="btn-outline flex-1">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
