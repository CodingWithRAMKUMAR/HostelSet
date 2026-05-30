import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function TenantDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tenant, setTenant] = useState(null)
  const [property, setProperty] = useState(null)
  const [room, setRoom] = useState(null)
  const [complaints, setComplaints] = useState([])
  const [notices, setNotices] = useState([])

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
      
      // Get tenant record
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('*, property:property_id(*), room:room_id(*)')
        .eq('user_id', userId)
        .single()

      if (tenantData) {
        setTenant(tenantData)
        setProperty(tenantData.property)
        setRoom(tenantData.room)
      }

      // Get complaints
      const { data: complaintsData } = await supabase
        .from('complaints')
        .select('*')
        .eq('tenant_id', tenantData?.id)
        .order('created_at', { ascending: false })

      if (complaintsData) setComplaints(complaintsData)

      // Get notices
      const { data: noticesData } = await supabase
        .from('notices')
        .select('*')
        .eq('property_id', tenantData?.property_id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (noticesData) setNotices(noticesData)
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.clear()
    router.push('/')
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="gradient-bg text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-lg">
        <h1 className="text-2xl font-bold">🏠 HOSTELSET</h1>
        <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600 transition">
          Logout
        </button>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">My Stay</h1>
          <p className="text-gray-500 mt-1">Welcome to your home, {tenant?.name}</p>
        </motion.div>

        {/* Room & Rent Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">🏠 Current Room</h2>
            <p className="text-3xl font-bold text-primary">Room {room?.room_number}</p>
            <p className="text-gray-600 mt-2">{property?.name}</p>
            <p className="text-gray-500 text-sm">{property?.address}, {property?.city}</p>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">💰 Rent Status</h2>
            <p className={`text-3xl font-bold ${tenant?.rent_status === 'paid' ? 'text-green-600' : 'text-red-600'}`}>
              {tenant?.rent_status === 'paid' ? '✅ Paid' : '⚠️ Due'}
            </p>
            <p className="text-gray-600 mt-2">Amount: ₹{tenant?.rent_amount?.toLocaleString()}/month</p>
            <p className="text-gray-500 text-sm">Due on 5th of every month</p>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <button className="bg-primary text-white p-4 rounded-xl font-semibold hover:bg-opacity-90 transition transform hover:scale-105">
            💰 Pay Rent
          </button>
          <button className="bg-secondary text-white p-4 rounded-xl font-semibold hover:bg-opacity-90 transition transform hover:scale-105">
            🔧 Raise Complaint
          </button>
          <button className="bg-green-600 text-white p-4 rounded-xl font-semibold hover:bg-opacity-90 transition transform hover:scale-105">
            📢 View Notices
          </button>
        </div>

        {/* Notices & Complaints */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">📢 Recent Notices</h2>
            <div className="space-y-3">
              {notices.length > 0 ? (
                notices.map((notice) => (
                  <div key={notice.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold">{notice.title}</p>
                      <p className="text-sm text-gray-500">{notice.content}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(notice.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-400 py-4">No notices yet</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">🔧 My Complaints</h2>
            <div className="space-y-3">
              {complaints.length > 0 ? (
                complaints.map((complaint) => (
                  <div key={complaint.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold">{complaint.title}</p>
                      <p className="text-sm text-gray-500">{complaint.description}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      complaint.status === 'open' ? 'bg-yellow-100 text-yellow-700' :
                      complaint.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {complaint.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-400 py-4">No complaints yet</p>
              )}
            </div>
            <button className="mt-4 text-primary font-semibold hover:underline">+ Raise New Complaint</button>
          </div>
        </div>
      </div>
    </div>
  )
}
