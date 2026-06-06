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
  const [roomMembers, setRoomMembers] = useState([])
  const [paymentHistory, setPaymentHistory] = useState([])
  const [complaints, setComplaints] = useState([])
  const [notices, setNotices] = useState([])
  const [checkOutRequest, setCheckOutRequest] = useState(null)
  const [showComplaintModal, setShowComplaintModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
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
        
        // Get room members (other tenants in same room)
        const { data: members } = await supabase
          .from('tenants')
          .select('name, phone, move_in_date')
          .eq('room_id', tenantData.room_id)
          .neq('id', tenantData.id)
        setRoomMembers(members || [])
        
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

  const getDaysUntilDue = () => {
    const today = new Date()
    const dueDate = new Date()
    dueDate.setDate(property?.rent_due_day || 5)
    if (today > dueDate) return 0
    return Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!tenant || !tenant.room_id || !room) {
    return (
      <div className="min-h-screen bg-white">
        <nav className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">🏠 HOSTELSET</h1>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Tenant</span>
          </div>
          <button onClick={handleLogout} className="text-red-500 hover:text-red-600 transition">Logout</button>
        </nav>
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-6">⏳</div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Waiting for Room Assignment</h1>
            <p className="text-gray-500 mb-4">Your tenant account has been created successfully!</p>
            <p className="text-gray-500 mb-6">Please wait for the PG owner to assign you a room.</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm text-yellow-600">📌 What to do next:</p>
              <ul className="text-sm text-gray-600 mt-2 space-y-1">
                <li>• Contact your PG owner with your registered phone number</li>
                <li>• Owner will assign you a room from their dashboard</li>
                <li>• You will see your room details here once assigned</li>
              </ul>
            </div>
            <button onClick={handleLogout} className="bg-slate-800 text-white px-6 py-3 rounded-full font-semibold">Logout</button>
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
  const daysUntilDue = getDaysUntilDue()

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 px-6 py-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">🏠 HOSTELSET</h1>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Tenant</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm hidden md:inline text-gray-500">Welcome, {tenant.name}</span>
            <button onClick={handleLogout} className="text-red-500 hover:text-red-600 transition">Logout</button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Rent Due Reminder Banner */}
        {daysUntilDue > 0 && daysUntilDue <= 3 && isRentDue && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-yellow-600 font-semibold">⚠️ Rent due in {daysUntilDue} days!</span>
              <p className="text-sm text-yellow-500 mt-1">Please pay your rent before the due date.</p>
            </div>
            <button onClick={() => setShowPayModal(true)} className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-700 transition">Pay Now</button>
          </div>
        )}

        {/* Property Images Gallery */}
        {property?.photos && property.photos.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">📸 Property Gallery</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {property.photos.slice(0, 4).map((img, i) => (
                <img key={i} src={img} alt={`Property ${i + 1}`} className="w-full h-32 object-cover rounded-lg hover:opacity-90 transition" />
              ))}
            </div>
          </div>
        )}

        {/* Room and Rent Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition">
            <h2 className="text-xl font-bold text-slate-800 mb-4">🏠 My Room</h2>
            <p className="text-3xl font-bold text-primary">Room {room?.room_number}</p>
            <p className="text-gray-500 mt-2">{property?.name}</p>
            <p className="text-gray-400 text-sm">{property?.address}</p>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-2xl">{sharingDetails.icon}</span>
              <span className="text-slate-700">{sharingDetails.label}</span>
              <span className="text-xs text-gray-400">({sharingDetails.description})</span>
            </div>
            <p className="text-gray-400 text-sm mt-2">Joined: {formatDate(tenant.move_in_date)}</p>
            <button onClick={() => setShowMembersModal(true)} className="mt-4 w-full bg-slate-100 text-slate-700 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 transition">👥 View Room Members ({roomMembers.length + 1})</button>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition">
            <h2 className="text-xl font-bold text-slate-800 mb-4">💰 Rent Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-gray-500">Monthly Rent:</span><span className="font-bold text-slate-800">{formatCurrency(tenant.rent_amount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total Paid:</span><span className="font-bold text-green-600">{formatCurrency(tenant.total_paid || 0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Pending Amount:</span><span className={`font-bold ${isRentDue ? 'text-red-500' : 'text-green-600'}`}>{formatCurrency(pendingAmount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Due Date:</span><span className="font-bold text-slate-800">Every {property?.rent_due_day || 5}th</span></div>
              {tenant.last_payment_date && (<div className="flex justify-between"><span className="text-gray-500">Last Payment:</span><span className="text-sm text-gray-500">{formatDate(tenant.last_payment_date)}</span></div>)}
              {daysOverdue > 0 && (<div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2"><p className="text-red-600 font-semibold">⚠️ Overdue by {daysOverdue} days!</p><p className="text-xs text-red-500 mt-1">Late fee of ₹{property?.late_fee_per_day || 50}/day applies.</p></div>)}
            </div>
            {isRentDue && (<button onClick={() => setShowPayModal(true)} className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold mt-4 hover:bg-slate-700 transition">Pay Rent Now →</button>)}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <button onClick={() => setShowComplaintModal(true)} className="bg-white border border-gray-200 rounded-xl p-4 text-center font-semibold text-slate-700 hover:shadow-md transition">🔧 Raise Complaint</button>
          <button onClick={() => setShowCheckoutModal(true)} className="bg-white border border-gray-200 rounded-xl p-4 text-center font-semibold text-slate-700 hover:shadow-md transition">🚪 Request Check-Out</button>
          <button className="bg-white border border-gray-200 rounded-xl p-4 text-center font-semibold text-slate-700 hover:shadow-md transition">📢 View Notices</button>
        </div>

        {/* Check-Out Request Status */}
        {checkOutRequest && (
          <div className={`rounded-xl p-4 mb-8 border ${checkOutRequest.status === 'pending' ? 'bg-yellow-50 border-yellow-200' : checkOutRequest.status === 'approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <h3 className="font-bold mb-2 text-slate-800">📋 Check-Out Request Status</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p className="text-gray-500">Status:</p><p className={`font-semibold ${checkOutRequest.status === 'pending' ? 'text-yellow-600' : checkOutRequest.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>{checkOutRequest.status.toUpperCase()}</p>
              <p className="text-gray-500">Requested on:</p><p>{formatDate(checkOutRequest.requested_date)}</p>
              <p className="text-gray-500">Expected Check-Out:</p><p>{formatDate(checkOutRequest.expected_check_out)}</p>
              {checkOutRequest.reason && (<><p className="text-gray-500">Reason:</p><p className="text-gray-600">{checkOutRequest.reason}</p></>)}
              {checkOutRequest.owner_notes && (<><p className="text-gray-500">Owner Response:</p><p className="text-gray-600">{checkOutRequest.owner_notes}</p></>)}
            </div>
            {checkOutRequest.status === 'approved' && (<div className="bg-green-100 rounded-lg p-2 mt-3 text-sm text-green-700">✅ Your check-out request has been approved. Please clear all pending dues before leaving.</div>)}
          </div>
        )}

        {/* Payment History */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">📜 Payment History</h2>
          {paymentHistory.length > 0 ? (
            <div className="space-y-3">{paymentHistory.map(p => (<div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"><div><p className="font-medium text-slate-800">{formatCurrency(p.amount)}</p><p className="text-xs text-gray-500">{formatDate(p.payment_date)}</p></div><div className="text-right"><span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Success</span><p className="text-xs text-gray-500 mt-1">{p.payment_method}</p></div></div>))}</div>
          ) : (<div className="text-center py-8 text-gray-400">No payment history yet</div>)}
        </div>

        {/* Complaints Section */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-8">
          <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-slate-800">🔧 My Complaints</h2><button onClick={() => setShowComplaintModal(true)} className="text-primary text-sm hover:underline">+ Raise New</button></div>
          {complaints.length > 0 ? (<div className="space-y-3">{complaints.map(c => (<div key={c.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"><div className="flex-1"><p className="font-semibold text-slate-800">{c.title}</p><p className="text-sm text-gray-500 mt-1">{c.description.substring(0, 100)}...</p><p className="text-xs text-gray-400 mt-1">Submitted: {formatDate(c.created_at)}</p></div><div className="text-right"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${c.status === 'open' ? 'bg-red-100 text-red-700' : c.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{c.status === 'open' ? 'Open' : c.status === 'in_progress' ? 'In Progress' : 'Resolved'}</span></div></div>))}</div>) : (<div className="text-center py-8 text-gray-400">No complaints raised yet</div>)}
        </div>

        {/* Notices Section */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">📢 Notices</h2>
          {notices.length > 0 ? (<div className="space-y-3">{notices.map(n => (<div key={n.id} className={`p-3 rounded-lg ${n.is_urgent ? 'bg-red-50 border-l-4 border-red-500' : 'bg-gray-50'}`}><div className="flex items-center gap-2 mb-1"><p className="font-semibold text-slate-800">{n.title}</p>{n.is_urgent && <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-xs">URGENT</span>}</div><p className="text-sm text-gray-600">{n.content}</p><p className="text-xs text-gray-400 mt-2">Posted: {formatDate(n.created_at)}</p></div>))}</div>) : (<div className="text-center py-8 text-gray-400">No notices yet</div>)}
        </div>
      </div>

      {/* Room Members Modal */}
      <AnimatePresence>
        {showMembersModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowMembersModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold text-slate-800">Room Members</h2><button onClick={() => setShowMembersModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button></div>
              <div className="space-y-3">
                <div className="bg-slate-50 rounded-lg p-3"><div className="flex justify-between items-center"><div><p className="font-semibold text-slate-800">{tenant.name} (You)</p><p className="text-xs text-gray-500">Joined: {formatDate(tenant.move_in_date)}</p></div><span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">Current</span></div></div>
                {roomMembers.map((member, idx) => (<div key={idx} className="bg-gray-50 rounded-lg p-3"><p className="font-semibold text-slate-800">{member.name}</p><p className="text-xs text-gray-500">Joined: {formatDate(member.move_in_date)}</p></div>))}
                {roomMembers.length === 0 && <p className="text-center text-gray-400 py-4">No other members in this room</p>}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Raise Complaint Modal */}
      <AnimatePresence>
        {showComplaintModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowComplaintModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Raise a Complaint</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Subject / Title *" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={complaintForm.title} onChange={(e) => setComplaintForm({...complaintForm, title: e.target.value})} />
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={complaintForm.category} onChange={(e) => setComplaintForm({...complaintForm, category: e.target.value})}>
                  <option value="plumbing">Plumbing Issue</option><option value="electrical">Electrical Issue</option><option value="cleaning">Cleaning</option><option value="internet">Internet/WiFi</option><option value="furniture">Furniture Issue</option><option value="other">Other</option>
                </select>
                <textarea placeholder="Detailed description *" rows="4" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={complaintForm.description} onChange={(e) => setComplaintForm({...complaintForm, description: e.target.value})} />
                <div className="flex gap-3 mt-6"><button onClick={raiseComplaint} disabled={isSubmitting} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold">{isSubmitting ? 'Submitting...' : 'Submit Complaint'}</button><button onClick={() => setShowComplaintModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button></div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Pay Rent Modal */}
      <AnimatePresence>
        {showPayModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPayModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4 text-center">Pay Rent</h2>
              <div className="bg-gray-50 rounded-xl p-4 mb-4"><p className="text-gray-500 text-sm">Room {room?.room_number} • {property?.name}</p><p className="text-2xl font-bold text-primary mt-1">{formatCurrency(tenant.rent_amount)}</p><div className="flex justify-between mt-3 pt-3 border-t border-gray-200"><span className="text-gray-500">Total Paid:</span><span className="text-green-600">{formatCurrency(tenant.total_paid || 0)}</span></div><div className="flex justify-between"><span className="text-gray-500">Pending:</span><span className="text-red-500">{formatCurrency(pendingAmount)}</span></div></div>
              <input type="number" placeholder="Enter amount to pay (₹)" className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
              <div className="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-600 mb-4">💡 Demo payment. No real transaction.</div>
              <div className="flex gap-3"><button onClick={payRent} disabled={isSubmitting} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold">{isSubmitting ? 'Processing...' : 'Pay Now'}</button><button onClick={() => setShowPayModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button></div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Request Check-Out Modal */}
      <AnimatePresence>
        {showCheckoutModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCheckoutModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Request Check-Out</h2>
              <div className="space-y-4">
                <div><label className="block text-gray-700 text-sm mb-1">Expected Check-Out Date *</label><input type="date" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={checkoutForm.expected_date} onChange={(e) => setCheckoutForm({...checkoutForm, expected_date: e.target.value})} /><p className="text-xs text-gray-500 mt-1">Notice period: 30 days from today</p></div>
                <div><label className="block text-gray-700 text-sm mb-1">Reason (Optional)</label><textarea placeholder="e.g., Moving to another city, job change, etc." rows="3" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={checkoutForm.reason} onChange={(e) => setCheckoutForm({...checkoutForm, reason: e.target.value})} /></div>
                <div className="bg-yellow-50 rounded-lg p-3 text-sm"><p className="font-semibold text-yellow-700">⚠️ Important Notes:</p><ul className="text-xs text-yellow-600 mt-2 space-y-1"><li>• Notice period: 30 days</li><li>• Clear all pending dues before check-out</li><li>• Security deposit will be refunded after deductions</li></ul></div>
                <div className="flex gap-3 mt-6"><button onClick={requestCheckout} disabled={isSubmitting} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold">{isSubmitting ? 'Submitting...' : 'Submit Request'}</button><button onClick={() => setShowCheckoutModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button></div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
