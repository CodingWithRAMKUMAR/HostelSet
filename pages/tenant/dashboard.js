import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate, getDaysOverdue, getSharingDetails, cleanPhoneNumber } from '../../lib/utils'
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
      const cleanPhone = cleanPhoneNumber(userPhone)
      
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle()
      
      if (tenantData && tenantData.room_id) {
        setTenant(tenantData)
        
        const { data: roomData } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', tenantData.room_id)
          .single()
        setRoom(roomData)
        
        const { data: propertyData } = await supabase
          .from('properties')
          .select('*')
          .eq('id', tenantData.property_id)
          .single()
        setProperty(propertyData)
        
        const { data: payments } = await supabase
          .from('payment_history')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .order('payment_date', { ascending: false })
        setPaymentHistory(payments || [])
        
        const { data: complaintsData } = await supabase
          .from('complaints')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .order('created_at', { ascending: false })
        setComplaints(complaintsData || [])
        
        const { data: noticesData } = await supabase
          .from('notices')
          .select('*')
          .eq('property_id', tenantData.property_id)
          .order('created_at', { ascending: false })
        setNotices(noticesData || [])
        
        const { data: checkOutData } = await supabase
          .from('check_out_requests')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .order('created_at', { ascending: false })
          .limit(1)
        setCheckOutRequest(checkOutData?.[0] || null)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const raiseComplaint = async () => {
    if (!complaintForm.title || !complaintForm.description) {
      toast.error('Please fill all fields')
      return
    }
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('complaints').insert({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        room_number: room?.room_number,
        title: complaintForm.title,
        description: complaintForm.description,
        category: complaintForm.category,
        status: 'open'
      })
      if (error) throw error
      toast.success('Complaint raised successfully!')
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
      toast.error('Please select expected check-out date')
      return
    }
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('check_out_requests').insert({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        room_number: room?.room_number,
        requested_date: new Date().toISOString().split('T')[0],
        expected_check_out: checkoutForm.expected_date,
        reason: checkoutForm.reason,
        notice_period_days: 30,
        status: 'pending'
      })
      if (error) throw error
      toast.success('Check-out request submitted! Owner will review it.')
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
      toast.error('Please enter a valid amount')
      return
    }
    const amount = parseInt(paymentAmount)
    const maxAmount = tenant.pending_amount || tenant.rent_amount
    if (amount > maxAmount) {
      toast.error(`Amount cannot exceed pending amount: ₹${maxAmount.toLocaleString()}`)
      return
    }
    setIsSubmitting(true)
    try {
      await supabase.from('payment_history').insert({
        tenant_id: tenant.id,
        amount: amount,
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
      toast.error('Payment failed. Please try again.')
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

  if (!tenant || !tenant.room_id || !room) {
    return (
      <div className="min-h-screen" style={{ background: '#0f172a' }}>
        <nav className="navbar py-4 px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-primary">🏠 HOSTELSET</h1>
            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">Tenant</span>
          </div>
          <button onClick={handleLogout} className="text-red-400 hover:text-red-300 transition">Logout</button>
        </nav>
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-6 animate-float">⏳</div>
            <h1 className="text-2xl font-bold text-white mb-2">Waiting for Room Assignment</h1>
            <p className="text-gray-400 mb-4">Your tenant account has been created successfully!</p>
            <p className="text-gray-400 mb-6">Please wait for the PG owner to assign you a room.</p>
            <div className="bg-yellow-500/10 border border-yellow-500 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm text-yellow-400">📌 What to do next:</p>
              <ul className="text-sm text-gray-400 mt-2 space-y-1">
                <li>• Contact your PG owner with your registered phone number</li>
                <li>• Owner will assign you a room from their dashboard</li>
                <li>• You will see your room details here once assigned</li>
                <li>• Then you can pay rent and raise complaints</li>
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
      {/* Header */}
      <nav className="navbar py-4 px-6 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-primary">🏠 HOSTELSET</h1>
          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">Tenant</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm hidden md:inline text-gray-300">Welcome, {tenant.name}</span>
          <button onClick={handleLogout} className="text-red-400 hover:text-red-300 transition">Logout</button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Property Images Gallery */}
        {property?.photos && property.photos.length > 0 && (
          <div className="card mb-8">
            <h2 className="text-xl font-bold mb-4">📸 Property Gallery</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {property.photos.slice(0, 4).map((img, i) => (
                <img key={i} src={img} alt={`Property ${i + 1}`} className="w-full h-32 object-cover rounded-lg hover:opacity-90 transition" />
              ))}
            </div>
          </div>
        )}

        {/* Room and Rent Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Room Card */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">🏠 My Room</h2>
            <p className="text-3xl font-bold text-primary">Room {room?.room_number}</p>
            <p className="text-gray-400 mt-2">{property?.name}</p>
            <p className="text-gray-500 text-sm">{property?.address}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-lg">{sharingDetails.icon}</span>
              <span className="text-gray-300">{sharingDetails.label}</span>
              <span className="text-xs text-gray-500">({sharingDetails.description})</span>
            </div>
            <p className="text-gray-500 text-sm mt-2">Joined on: {formatDate(tenant.move_in_date)}</p>
          </div>

          {/* Rent Card */}
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
                <span className="text-gray-400">Pending Amount:</span>
                <span className={`font-bold ${isRentDue ? 'text-red-400' : 'text-green-400'}`}>
                  {formatCurrency(pendingAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Due Date:</span>
                <span className="font-bold">Every {property?.rent_due_day || 5}th of the month</span>
              </div>
              {tenant.last_payment_date && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Last Payment:</span>
                  <span className="text-sm text-gray-500">{formatDate(tenant.last_payment_date)}</span>
                </div>
              )}
              {daysOverdue > 0 && (
                <div className="alert-danger mt-2">
                  ⚠️ Overdue by {daysOverdue} days! Late fee of ₹{property?.late_fee_per_day || 50}/day applies.
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

        {/* Quick Actions */}
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

        {/* Check-Out Request Status - Visible to tenant */}
        {checkOutRequest && (
          <div className={`card p-4 mb-8 ${checkOutRequest.status === 'pending' ? 'border-l-4 border-l-yellow-500' : checkOutRequest.status === 'approved' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}>
            <h3 className="font-bold mb-2">📋 Check-Out Request Status</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p className="text-gray-400">Status:</p>
              <p className={`font-semibold ${
                checkOutRequest.status === 'pending' ? 'text-yellow-400' : 
                checkOutRequest.status === 'approved' ? 'text-green-400' : 'text-red-400'
              }`}>{checkOutRequest.status.toUpperCase()}</p>
              
              <p className="text-gray-400">Requested on:</p>
              <p>{formatDate(checkOutRequest.requested_date)}</p>
              
              <p className="text-gray-400">Expected Check-Out:</p>
              <p>{formatDate(checkOutRequest.expected_check_out)}</p>
              
              {checkOutRequest.reason && (
                <>
                  <p className="text-gray-400">Reason:</p>
                  <p className="text-gray-300">{checkOutRequest.reason}</p>
                </>
              )}
              {checkOutRequest.owner_notes && (
                <>
                  <p className="text-gray-400">Owner Response:</p>
                  <p className="text-gray-300">{checkOutRequest.owner_notes}</p>
                </>
              )}
            </div>
            {checkOutRequest.status === 'approved' && (
              <div className="alert-success mt-3 text-sm">
                ✅ Your check-out request has been approved. Please clear all pending dues before leaving.
              </div>
            )}
          </div>
        )}

        {/* Payment History */}
        <div className="card p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">📜 Payment History</h2>
          {paymentHistory.length > 0 ? (
            <div className="space-y-3">
              {paymentHistory.map(p => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-dark rounded-lg">
                  <div>
                    <p className="font-medium">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-gray-500">{formatDate(p.payment_date)}</p>
                  </div>
                  <div className="text-right">
                    <span className="badge-success">Success</span>
                    <p className="text-xs text-gray-500 mt-1">{p.payment_method}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No payment history yet</div>
          )}
        </div>

        {/* Complaints Section */}
        <div className="card p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">🔧 My Complaints</h2>
            <button onClick={() => setShowComplaintModal(true)} className="text-primary text-sm hover:underline">+ Raise New Complaint</button>
          </div>
          {complaints.length > 0 ? (
            <div className="space-y-3">
              {complaints.map(c => (
                <div key={c.id} className="flex justify-between items-center p-3 bg-dark rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-sm text-gray-400">{c.description.substring(0, 100)}...</p>
                    <p className="text-xs text-gray-500 mt-1">Submitted: {formatDate(c.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`badge-${c.status === 'open' ? 'danger' : c.status === 'in_progress' ? 'warning' : 'success'}`}>
                      {c.status === 'open' ? 'Open' : c.status === 'in_progress' ? 'In Progress' : 'Resolved'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No complaints raised yet</div>
          )}
        </div>

        {/* Notices Section */}
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">📢 Notices</h2>
          {notices.length > 0 ? (
            <div className="space-y-3">
              {notices.map(n => (
                <div key={n.id} className={`p-3 rounded-lg ${n.is_urgent ? 'bg-red-500/10 border-l-4 border-red-500' : 'bg-dark'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">{n.title}</p>
                    {n.is_urgent && <span className="badge-danger text-xs">URGENT</span>}
                    <span className="badge-info text-xs">{n.type}</span>
                  </div>
                  <p className="text-sm text-gray-400">{n.content}</p>
                  <p className="text-xs text-gray-500 mt-2">Posted: {formatDate(n.created_at)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No notices yet</div>
          )}
        </div>
      </div>

      {/* Raise Complaint Modal */}
      <AnimatePresence>
        {showComplaintModal && (
          <div className="modal-overlay" onClick={() => setShowComplaintModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Raise a Complaint</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Subject / Title *" className="input" value={complaintForm.title} onChange={(e) => setComplaintForm({...complaintForm, title: e.target.value})} />
                <select className="input" value={complaintForm.category} onChange={(e) => setComplaintForm({...complaintForm, category: e.target.value})}>
                  <option value="plumbing">Plumbing Issue</option>
                  <option value="electrical">Electrical Issue</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="internet">Internet/WiFi</option>
                  <option value="furniture">Furniture Issue</option>
                  <option value="other">Other</option>
                </select>
                <textarea placeholder="Detailed description *" rows="4" className="input" value={complaintForm.description} onChange={(e) => setComplaintForm({...complaintForm, description: e.target.value})} />
                <div className="flex gap-3 mt-6">
                  <button onClick={raiseComplaint} disabled={isSubmitting} className="btn-primary flex-1">{isSubmitting ? 'Submitting...' : 'Submit Complaint'}</button>
                  <button onClick={() => setShowComplaintModal(false)} className="btn-outline flex-1">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Pay Rent Modal */}
      <AnimatePresence>
        {showPayModal && (
          <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4 text-center">Pay Rent</h2>
              <div className="bg-dark rounded-xl p-4 mb-4">
                <p className="text-gray-400 text-sm">Room {room?.room_number} • {property?.name}</p>
                <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(tenant.rent_amount)}</p>
                <div className="flex justify-between mt-3 pt-3 border-t border-gray-700">
                  <span className="text-gray-400">Total Paid:</span>
                  <span className="text-green-400">{formatCurrency(tenant.total_paid || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Pending:</span>
                  <span className="text-red-400">{formatCurrency(pendingAmount)}</span>
                </div>
              </div>
              <input type="number" placeholder="Enter amount to pay (₹)" className="input" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
              <div className="bg-yellow-500/20 p-3 rounded-lg text-sm text-yellow-400 mt-4">
                💡 Demo payment. No real transaction.
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={payRent} disabled={isSubmitting} className="btn-success flex-1">{isSubmitting ? 'Processing...' : 'Pay Now'}</button>
                <button onClick={() => setShowPayModal(false)} className="btn-outline flex-1">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Request Check-Out Modal */}
      <AnimatePresence>
        {showCheckoutModal && (
          <div className="modal-overlay" onClick={() => setShowCheckoutModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Request Check-Out</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Expected Check-Out Date *</label>
                  <input type="date" className="input" value={checkoutForm.expected_date} onChange={(e) => setCheckoutForm({...checkoutForm, expected_date: e.target.value})} />
                  <p className="text-xs text-gray-500 mt-1">Notice period: 30 days from today</p>
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Reason for leaving (Optional)</label>
                  <textarea placeholder="e.g., Moving to another city, job change, etc." rows="3" className="input" value={checkoutForm.reason} onChange={(e) => setCheckoutForm({...checkoutForm, reason: e.target.value})} />
                </div>
                <div className="alert-warning">
                  <p className="font-semibold">⚠️ Important Notes:</p>
                  <ul className="text-xs mt-2 space-y-1">
                    <li>• Notice period: 30 days</li>
                    <li>• You will need to clear all pending dues before check-out</li>
                    <li>• Security deposit will be refunded after deduction of any pending dues</li>
                    <li>• Owner will review and approve your request</li>
                  </ul>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={requestCheckout} disabled={isSubmitting} className="btn-primary flex-1">{isSubmitting ? 'Submitting...' : 'Submit Request'}</button>
                  <button onClick={() => setShowCheckoutModal(false)} className="btn-outline flex-1">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
