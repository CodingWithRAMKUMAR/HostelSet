import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function TenantDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tenant, setTenant] = useState(null)
  const [property, setProperty] = useState(null)
  const [room, setRoom] = useState(null)
  const [paymentHistory, setPaymentHistory] = useState([])
  const [complaints, setComplaints] = useState([])
  const [showComplaintModal, setShowComplaintModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [complaintForm, setComplaintForm] = useState({ title: '', description: '', category: 'other' })
  const [paymentAmount, setPaymentAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const sharingTypes = {
    single: { label: 'Single Sharing', icon: '👤', description: 'Private room for 1 person' },
    double: { label: 'Double Sharing', icon: '👥', description: 'Shared room for 2 persons' },
    triple: { label: 'Triple Sharing', icon: '👥👤', description: 'Shared room for 3 persons' },
    four: { label: 'Four Sharing', icon: '👥👥', description: 'Shared room for 4 persons' },
    five: { label: 'Five Sharing', icon: '👥👥👤', description: 'Shared room for 5 persons' },
  }

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    const userRole = localStorage.getItem('userRole')
    const userId = localStorage.getItem('userId')
    
    console.log('Tenant Dashboard - Debug:')
    console.log('isLoggedIn:', isLoggedIn)
    console.log('userRole:', userRole)
    console.log('userId:', userId)
    
    if (!isLoggedIn || userRole !== 'tenant' || !userId) {
      router.push('/login')
      return
    }
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const userId = localStorage.getItem('userId')
      
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*, rooms:room_id(*), properties:property_id(*)')
        .eq('user_id', userId)
        .maybeSingle()

      console.log('Tenant data:', tenantData)

      if (tenantError) {
        console.error('Tenant fetch error:', tenantError)
      }

      if (tenantData) {
        setTenant(tenantData)
        setRoom(tenantData.rooms)
        setProperty(tenantData.properties)

        const { data: payments, error: paymentsError } = await supabase
          .from('payment_history')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .order('payment_date', { ascending: false })

        if (paymentsError) {
          console.error('Payments fetch error:', paymentsError)
        } else if (payments) {
          setPaymentHistory(payments)
        }

        const { data: complaintsData, error: complaintsError } = await supabase
          .from('complaints')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .order('created_at', { ascending: false })

        if (complaintsError) {
          console.error('Complaints fetch error:', complaintsError)
        } else if (complaintsData) {
          setComplaints(complaintsData)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load your data')
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
        priority: 'medium',
        status: 'open'
      })

      if (error) throw error

      toast.success('Complaint raised successfully!')
      setShowComplaintModal(false)
      setComplaintForm({ title: '', description: '', category: 'other' })
      await loadData()
    } catch (error) {
      console.error('Complaint error:', error)
      toast.error('Failed to raise complaint')
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
      const { error: paymentError } = await supabase.from('payment_history').insert({
        tenant_id: tenant.id,
        amount: amount,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'online',
        status: 'success'
      })

      if (paymentError) throw paymentError

      const newTotalPaid = (tenant.total_paid || 0) + amount
      const newPendingAmount = (tenant.pending_amount || tenant.rent_amount) - amount
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

      toast.success(`Payment of ₹${amount.toLocaleString()} successful!`)
      setShowPayModal(false)
      setPaymentAmount('')
      await loadData()
    } catch (error) {
      console.error('Payment error:', error)
      toast.error('Payment failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = () => {
    localStorage.clear()
    toast.success('Logged out successfully')
    router.push('/')
  }

  const getSharingDetails = (type) => {
    return sharingTypes[type] || sharingTypes.double
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="text-white text-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="gradient-bg text-white px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">🏠 HOSTELSET</h1>
          <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-lg">Logout</button>
        </nav>
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-6 animate-float">🏠</div>
            <h1 className="text-2xl font-bold mb-4">No Room Assigned Yet</h1>
            <p className="text-gray-500 mb-8">You haven't been assigned to any room. Please contact your PG owner.</p>
            <button onClick={handleLogout} className="bg-primary text-white px-6 py-3 rounded-xl font-semibold">
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  const sharingDetails = getSharingDetails(room?.sharing_type)
  const pendingAmount = tenant.pending_amount || tenant.rent_amount
  const isRentDue = pendingAmount > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="gradient-bg text-white px-6 py-4 flex justify-between items-center shadow-lg sticky top-0 z-50">
        <h1 className="text-2xl font-bold">🏠 HOSTELSET</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm hidden md:inline">Welcome, {tenant.name}</span>
          <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600 transition">
            Logout
          </button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">My Stay</h1>
          <p className="text-gray-500 mt-1">Welcome to your home, {tenant.name}</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">🏠 My Room</h2>
            <p className="text-3xl font-bold text-primary">Room {room?.room_number}</p>
            <p className="text-gray-600 mt-2">{property?.name}</p>
            <p className="text-gray-500 text-sm">{property?.address}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-lg">{sharingDetails.icon}</span>
              <span className="text-gray-600">{sharingDetails.label}</span>
              <span className="text-xs text-gray-400">({sharingDetails.description})</span>
            </div>
            <p className="text-gray-500 text-sm mt-2">Joined on: {new Date(tenant.move_in_date).toLocaleDateString()}</p>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">💰 Rent Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Monthly Rent:</span>
                <span className="font-bold text-gray-800">₹{tenant.rent_amount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Paid:</span>
                <span className="font-bold text-green-600">₹{(tenant.total_paid || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Pending Amount:</span>
                <span className={`font-bold ${isRentDue ? 'text-red-600' : 'text-green-600'}`}>
                  ₹{pendingAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isRentDue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {isRentDue ? '⚠️ Pending' : '✅ Paid'}
                </span>
              </div>
              {tenant.last_payment_date && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Last Payment:</span>
                  <span className="text-sm text-gray-500">{new Date(tenant.last_payment_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
            {isRentDue && (
              <button onClick={() => setShowPayModal(true)} className="mt-4 w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition">
                Pay Rent Now →
              </button>
            )}
          </motion.div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowComplaintModal(true)} className="bg-secondary text-white p-4 rounded-xl font-semibold shadow-md">
            🔧 Raise Complaint
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-primary text-white p-4 rounded-xl font-semibold shadow-md">
            📢 View Notices
          </motion.button>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">📜 Payment History</h2>
          <div className="space-y-3">
            {paymentHistory.length > 0 ? (
              paymentHistory.map((payment) => (
                <div key={payment.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">₹{payment.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{new Date(payment.payment_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Success</span>
                    <p className="text-xs text-gray-400 mt-1">{payment.payment_method}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">No payment history yet</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">🔧 My Complaints</h2>
            <button onClick={() => setShowComplaintModal(true)} className="text-primary text-sm font-semibold hover:underline">+ New Complaint</button>
          </div>
          <div className="space-y-3">
            {complaints.length > 0 ? (
              complaints.map((complaint) => (
                <div key={complaint.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-semibold">{complaint.title}</p>
                    <p className="text-sm text-gray-500">{complaint.description.substring(0, 60)}...</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(complaint.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    complaint.status === 'open' ? 'bg-red-100 text-red-700' :
                    complaint.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {complaint.status === 'open' ? 'Open' : complaint.status === 'in_progress' ? 'In Progress' : 'Resolved'}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">No complaints raised yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Raise Complaint Modal */}
      <AnimatePresence>
        {showComplaintModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Raise a Complaint</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Subject / Title" className="input" value={complaintForm.title} onChange={(e) => setComplaintForm({...complaintForm, title: e.target.value})} />
                <select className="input" value={complaintForm.category} onChange={(e) => setComplaintForm({...complaintForm, category: e.target.value})}>
                  <option value="plumbing">Plumbing Issue</option>
                  <option value="electrical">Electrical Issue</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="internet">Internet/WiFi</option>
                  <option value="furniture">Furniture Issue</option>
                  <option value="other">Other</option>
                </select>
                <textarea placeholder="Detailed description..." rows="4" className="input" value={complaintForm.description} onChange={(e) => setComplaintForm({...complaintForm, description: e.target.value})}></textarea>
                <div className="flex gap-3 mt-6">
                  <button onClick={raiseComplaint} disabled={isSubmitting} className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                    {isSubmitting ? 'Submitting...' : 'Submit Complaint'}
                  </button>
                  <button onClick={() => setShowComplaintModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pay Rent Modal */}
      <AnimatePresence>
        {showPayModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="text-center mb-4">
                <div className="text-5xl mb-2 animate-float">💰</div>
                <h2 className="text-2xl font-bold text-gray-800">Pay Rent</h2>
              </div>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex justify-between mb-2"><span className="text-gray-600">Room:</span><span className="font-semibold">Room {room?.room_number}</span></div>
                  <div className="flex justify-between mb-2"><span className="text-gray-600">Monthly Rent:</span><span className="font-semibold">₹{tenant.rent_amount?.toLocaleString()}</span></div>
                  <div className="flex justify-between mb-2"><span className="text-gray-600">Pending Amount:</span><span className="font-semibold text-red-600">₹{pendingAmount.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Total Paid:</span><span className="font-semibold text-green-600">₹{(tenant.total_paid || 0).toLocaleString()}</span></div>
                </div>
                <input type="number" placeholder="Enter Amount (₹)" className="input" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                <div className="bg-yellow-50 rounded-xl p-3 text-sm text-yellow-700">
                  💡 This is a demo payment. In production, Razorpay will be integrated.
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={payRent} disabled={isSubmitting} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                    {isSubmitting ? 'Processing...' : 'Pay Now'}
                  </button>
                  <button onClick={() => setShowPayModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
