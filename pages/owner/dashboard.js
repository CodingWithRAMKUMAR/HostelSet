import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function OwnerDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [property, setProperty] = useState(null)
  const [rooms, setRooms] = useState([])
  const [tenants, setTenants] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRentModal, setShowRentModal] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [activeTab, setActiveTab] = useState('tenants')
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', rent_amount: '', room_id: '' })
  const [stats, setStats] = useState({ totalRooms: 0, occupied: 0, vacant: 0, dueAmount: 0, monthlyRevenue: 0 })

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    const userRole = localStorage.getItem('userRole')
    if (!isLoggedIn || userRole !== 'owner') {
      router.push('/login')
      return
    }
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const userId = localStorage.getItem('userId')
      
      // Get property
      const { data: propertyData } = await supabase
        .from('properties')
        .select('*')
        .eq('owner_id', userId)
        .single()

      if (propertyData) {
        setProperty(propertyData)

        // Get rooms
        const { data: roomsData } = await supabase
          .from('rooms')
          .select('*')
          .eq('property_id', propertyData.id)

        if (roomsData) {
          setRooms(roomsData)
          const total = roomsData.length
          const occupied = roomsData.filter(r => r.status === 'occupied').length
          const vacant = roomsData.filter(r => r.status === 'vacant').length
          setStats(prev => ({ ...prev, totalRooms: total, occupied, vacant }))
        }

        // Get tenants with room info
        const { data: tenantsData } = await supabase
          .from('tenants')
          .select('*, rooms:room_id(*)')
          .eq('property_id', propertyData.id)

        if (tenantsData) {
          setTenants(tenantsData)
          const due = tenantsData.filter(t => t.rent_status === 'pending').reduce((sum, t) => sum + t.rent_amount, 0)
          const revenue = tenantsData.filter(t => t.rent_status === 'paid').reduce((sum, t) => sum + t.rent_amount, 0)
          setStats(prev => ({ ...prev, dueAmount: due, monthlyRevenue: revenue }))
        }
      }
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const addTenant = async () => {
    if (!formData.name || !formData.phone || !formData.rent_amount || !formData.room_id) {
      toast.error('Please fill all fields')
      return
    }

    const { error } = await supabase.from('tenants').insert({
      property_id: property.id,
      room_id: formData.room_id,
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      rent_amount: parseInt(formData.rent_amount),
      rent_status: 'pending',
      move_in_date: new Date().toISOString().split('T')[0]
    })

    if (error) {
      toast.error('Failed to add tenant')
    } else {
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', formData.room_id)
      toast.success('Tenant added successfully!')
      setShowAddModal(false)
      setFormData({ name: '', phone: '', email: '', rent_amount: '', room_id: '' })
      loadData()
    }
  }

  const markRentPaid = async () => {
    if (!selectedTenant) return

    const { error } = await supabase
      .from('tenants')
      .update({ rent_status: 'paid' })
      .eq('id', selectedTenant.id)

    if (error) {
      toast.error('Failed to update rent status')
    } else {
      toast.success(`Rent marked as paid for ${selectedTenant.name}`)
      setShowRentModal(false)
      loadData()
    }
  }

  const deleteTenant = async (id, roomId) => {
    if (confirm('Are you sure you want to remove this tenant?')) {
      await supabase.from('tenants').delete().eq('id', id)
      await supabase.from('rooms').update({ status: 'vacant' }).eq('id', roomId)
      toast.success('Tenant removed successfully')
      loadData()
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
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="gradient-bg text-white px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">🏠 HOSTELSET</h1>
          <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-lg">Logout</button>
        </nav>
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-6">🏠</div>
            <h1 className="text-2xl font-bold mb-4">No Property Found</h1>
            <p className="text-gray-500 mb-8">Register your first property to get started.</p>
            <Link href="/owner/register-property" className="btn-primary inline-block">
              Register Property →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="gradient-bg text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-lg">
        <Link href="/owner/dashboard" className="text-2xl font-bold">🏠 HOSTELSET</Link>
        <div className="flex items-center gap-4">
          <span className="text-sm hidden md:inline">{property.name} - {property.city}</span>
          <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600 transition">
            Logout
          </button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Owner Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back! Here's your property overview</p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-primary">
            <p className="text-gray-500 text-sm">Total Rooms</p>
            <p className="text-3xl font-bold text-primary">{stats.totalRooms}</p>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-green-500">
            <p className="text-gray-500 text-sm">Occupied</p>
            <p className="text-3xl font-bold text-green-600">{stats.occupied}</p>
            <p className="text-xs text-gray-400 mt-1">{stats.totalRooms ? Math.round((stats.occupied/stats.totalRooms)*100) : 0}% occupancy</p>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-orange-500">
            <p className="text-gray-500 text-sm">Vacant</p>
            <p className="text-3xl font-bold text-orange-500">{stats.vacant}</p>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-red-500">
            <p className="text-gray-500 text-sm">Pending Rent</p>
            <p className="text-3xl font-bold text-red-600">₹{stats.dueAmount.toLocaleString()}</p>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button onClick={() => setShowAddModal(true)} className="bg-primary text-white p-4 rounded-xl font-semibold hover:bg-opacity-90 transition transform hover:scale-105">
            + Add Tenant
          </button>
          <button className="bg-secondary text-white p-4 rounded-xl font-semibold hover:bg-opacity-90 transition transform hover:scale-105">
            📢 Post Notice
          </button>
          <button className="bg-green-600 text-white p-4 rounded-xl font-semibold hover:bg-opacity-90 transition transform hover:scale-105">
            💰 Collect Rent
          </button>
          <Link href="/owner/register-property" className="bg-purple-600 text-white p-4 rounded-xl font-semibold hover:bg-opacity-90 transition transform hover:scale-105 text-center">
            + New Property
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-6">
          {['tenants', 'rooms', 'payments'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold capitalize transition ${
                activeTab === tab
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tenants Tab */}
        {activeTab === 'tenants' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">📋 All Tenants</h2>
              <button onClick={() => setShowAddModal(true)} className="text-primary text-sm font-semibold">+ Add New</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Phone</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Room</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Rent</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="border-b hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-medium text-gray-800">{tenant.name}</td>
                      <td className="px-6 py-4 text-gray-600">{tenant.phone}</td>
                      <td className="px-6 py-4 text-gray-600">Room {tenant.rooms?.room_number || 'N/A'}</td>
                      <td className="px-6 py-4 font-semibold text-gray-800">₹{tenant.rent_amount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          tenant.rent_status === 'pending' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {tenant.rent_status === 'pending' ? '⚠️ Due' : '✅ Paid'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {tenant.rent_status === 'pending' && (
                          <button
                            onClick={() => { setSelectedTenant(tenant); setShowRentModal(true) }}
                            className="text-green-600 hover:text-green-800 font-medium mr-4 transition"
                          >
                            Mark Paid
                          </button>
                        )}
                        <button
                          onClick={() => deleteTenant(tenant.id, tenant.room_id)}
                          className="text-red-600 hover:text-red-800 font-medium transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tenants.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  No tenants yet. Click "Add Tenant" to get started.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {rooms.map((room) => (
                <div key={room.id} className={`border rounded-xl p-4 text-center hover:shadow-md transition cursor-pointer ${
                  room.status === 'occupied' ? 'bg-green-50 border-green-200' : 'bg-white'
                }`}>
                  <p className="font-bold text-lg">Room {room.room_number}</p>
                  <p className={`text-sm mt-2 font-semibold ${room.status === 'occupied' ? 'text-green-600' : 'text-orange-500'}`}>
                    {room.status === 'occupied' ? '👤 Occupied' : '🔓 Vacant'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">₹{room.monthly_rent}/month</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">Payment Summary</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-green-600 text-sm">Total Collected</p>
                <p className="text-2xl font-bold text-green-700">₹{stats.monthlyRevenue.toLocaleString()}</p>
                <p className="text-xs text-green-500 mt-1">This month</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-red-600 text-sm">Pending Collection</p>
                <p className="text-2xl font-bold text-red-700">₹{stats.dueAmount.toLocaleString()}</p>
                <p className="text-xs text-red-500 mt-1">From {tenants.filter(t => t.rent_status === 'pending').length} tenants</p>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="font-semibold mb-3">Recent Transactions</h3>
              <div className="space-y-2">
                {tenants.filter(t => t.rent_status === 'paid').map((tenant) => (
                  <div key={tenant.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div><p className="font-medium">{tenant.name}</p><p className="text-xs text-gray-500">Room {tenant.rooms?.room_number}</p></div>
                    <div className="text-right"><p className="font-bold text-green-600">₹{tenant.rent_amount.toLocaleString()}</p><p className="text-xs text-gray-400">Paid</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Tenant Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Add New Tenant</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Full Name" className="input" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                <input type="tel" placeholder="Phone Number" className="input" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                <input type="email" placeholder="Email (optional)" className="input" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                <input type="number" placeholder="Monthly Rent (₹)" className="input" value={formData.rent_amount} onChange={(e) => setFormData({...formData, rent_amount: e.target.value})} />
                <select className="input" value={formData.room_id} onChange={(e) => setFormData({...formData, room_id: e.target.value})}>
                  <option value="">Select Room</option>
                  {rooms.filter(r => r.status === 'vacant').map(room => (
                    <option key={room.id} value={room.id}>Room {room.room_number} - ₹{room.monthly_rent}/month</option>
                  ))}
                </select>
                <div className="flex gap-3 mt-6">
                  <button onClick={addTenant} className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold">Add Tenant</button>
                  <button onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mark Rent Paid Modal */}
      <AnimatePresence>
        {showRentModal && selectedTenant && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-2xl p-6 max-w-md w-full text-center shadow-2xl">
              <div className="text-5xl mb-4">💰</div>
              <h2 className="text-2xl font-bold mb-2 text-gray-800">Confirm Rent Payment</h2>
              <p className="text-gray-600 mb-2">Mark rent as paid for <strong className="text-primary">{selectedTenant.name}</strong></p>
              <p className="text-xl font-bold text-primary mb-6">₹{selectedTenant.rent_amount.toLocaleString()}</p>
              <div className="flex gap-3">
                <button onClick={markRentPaid} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold">Confirm Payment</button>
                <button onClick={() => setShowRentModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
