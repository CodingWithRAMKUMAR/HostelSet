import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function TenantDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tenant, setTenant] = useState(null)
  const [property, setProperty] = useState(null)
  const [room, setRoom] = useState(null)
  const [complaints, setComplaints] = useState([])
  const [showComplaintModal, setShowComplaintModal] = useState(false)
  const [complaintForm, setComplaintForm] = useState({ title: '', description: '', category: 'other' })
  const [showPayModal, setShowPayModal] = useState(false)
  const [paying, setPaying] = useState(false)

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
      const userId = localStorage.getItem('userId')
      
      // Get tenant record with room and property details
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*, rooms:room_id(*), properties:property_id(*)')
        .eq('user_id', userId)
        .single()

      if (tenantError && tenantError.code !== 'PGRST116') {
        console.error('Error loading tenant:', tenantError)
      }

      if (tenantData) {
        setTenant(tenantData)
        setRoom(tenantData.rooms)
        setProperty(tenantData.properties)
        
        // Load complaints for this tenant
        const { data: complaintsData } = await supabase
          .from('complaints')
          .select('*')
          .eq('tenant_id', tenantData.id)
          .order('created_at', { ascending: false })
        
        if (complaintsData) {
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

    setPaying(true)
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
      loadData()
    } catch (error) {
      toast.error('Failed to raise complaint')
    } finally {
      setPaying(false)
    }
  }

  const payRent = async () => {
    setPaying(true)
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const { error } = await supabase
        .from('tenants')
        .update({ rent_status: 'paid', updated_at: new Date() })
        .eq('id', tenant.id)

      if (error) throw error

      toast.success('Rent paid successfully!')
      setShowPayModal(false)
      loadData()
    } catch (error) {
      toast.error('Payment failed. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  const handleLogout = () => {
    localStorage.clear()
    router.push('/')
  }

  const getSharingIcon = (type) => {
    const icons = {
      single: '👤',
      double: '👥',
      triple: '👥👤',
      four: '👥👥',
      five: '👥👥👤'
    }
    return icons[type] || '🏠'
  }

  const getSharingLabel = (type) => {
    const labels = {
      single: 'Single Sharing',
      double: 'Double Sharing',
      triple: 'Triple Sharing',
      four: 'Four Sharing',
      five: 'Five Sharing'
    }
    return labels[type] || type
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
            <button onClick={handleLogout} className="btn-primary inline-block">
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  const sharingDetails = {
    icon: getSharingIcon(room?.sharing_type),
    label: getSharingLabel(room?.sharing_type)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="gradient-bg text-white px-6 py-4 flex justify-between items-center shadow-lg">
        <h1 className="text-2xl font-bold">🏠 HOSTELSET</h1>
        <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600 transition">
          Logout
        </button>
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
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">💰 Rent Status</h2>
            <p className={`text-3xl font-bold ${tenant.rent_status === 'paid' ? 'text-green-600' : 'text-red-600'}`}>
              {tenant.rent_status === 'paid' ? '✅ Paid' : '⚠️ Pending'}
            </p>
            <p className="text-gray-600 mt-2">Amount: ₹{tenant.rent_amount?.toLocaleString()}/month</p>
            <p className="text-gray-500 text-sm">Move-in date: {new Date(tenant.move_in_date).toLocaleDateString()}</p>
            {tenant.rent_status === 'pending' && (
              <button onClick={() => setShowPayModal(true)} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition w-full">
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

        {/* Complaints Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4">🔧 My Complaints</h2>
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
              <div className="text-center py-8 text-gray-400">
                No complaints raised yet. Click "Raise Complaint" if you have any issues.
              </div>
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
                <textarea placeholder="Detailed description of the issue..." rows="4" className="input" value={complaintForm.description} onChange={(e) => setComplaintForm({...complaintForm, description: e.target.value})}></textarea>
                <div className="flex gap-3 mt-6">
                  <button onClick={raiseComplaint} disabled={paying} className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                    {paying ? 'Submitting...' : 'Submit Complaint'}
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
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-2xl p-6 max-w-md w-full text-center shadow-2xl">
              <div className="text-5xl mb-4 animate-float">💰</div>
              <h2 className="text-2xl font-bold mb-2 text-gray-800">Confirm Rent Payment</h2>
              <p className="text-gray-600 mb-2">Pay rent for <strong className="text-primary">Room {room?.room_number}</strong></p>
              <p className="text-xl font-bold text-primary mb-4">₹{tenant.rent_amount?.toLocaleString()}</p>
              <div className="bg-yellow-50 rounded-xl p-3 mb-6 text-sm text-yellow-700">
                💡 This is a demo payment. In production, Razorpay will be integrated.
              </div>
              <div className="flex gap-3">
                <button onClick={payRent} disabled={paying} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                  {paying ? 'Processing...' : 'Confirm Payment'}
                </button>
                <button onClick={() => setShowPayModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
