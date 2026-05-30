import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function OwnerDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tenants, setTenants] = useState([])
  const [rooms, setRooms] = useState([])
  const [property, setProperty] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRentModal, setShowRentModal] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [activeTab, setActiveTab] = useState('tenants')
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', rent_amount: '', room_id: '' })
  const [roomForm, setRoomForm] = useState({ room_number: '', sharing_type: 'double', monthly_rent: 10000 })
  const [stats, setStats] = useState({ totalRooms: 0, occupied: 0, vacant: 0, dueAmount: 0, monthlyRevenue: 0 })

  const sharingTypes = [
    { value: 'single', label: 'Single Sharing', capacity: 1, icon: '👤', price: 15000, description: 'Private room for 1 person' },
    { value: 'double', label: 'Double Sharing', capacity: 2, icon: '👥', price: 10000, description: 'Shared room for 2 persons' },
    { value: 'triple', label: 'Triple Sharing', capacity: 3, icon: '👥👤', price: 8000, description: 'Shared room for 3 persons' },
    { value: 'four', label: 'Four Sharing', capacity: 4, icon: '👥👥', price: 7000, description: 'Shared room for 4 persons' },
    { value: 'five', label: 'Five Sharing', capacity: 5, icon: '👥👥👤', price: 6000, description: 'Shared room for 5 persons' },
  ]

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
      
      const { data: propertyData } = await supabase
        .from('properties')
        .select('*')
        .eq('owner_id', userId)
        .single()

      if (propertyData) {
        setProperty(propertyData)

        const { data: roomsData } = await supabase
          .from('rooms')
          .select('*')
          .eq('property_id', propertyData.id)
          .order('room_number', { ascending: true })

        if (roomsData) {
          setRooms(roomsData)
          const total = roomsData.length
          const occupied = roomsData.filter(r => r.current_occupants >= r.capacity).length
          const vacant = roomsData.filter(r => r.current_occupants < r.capacity).length
          setStats(prev => ({ ...prev, totalRooms: total, occupied, vacant }))
        }

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
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const addRoom = async () => {
    if (!roomForm.room_number || !roomForm.sharing_type) {
      toast.error('Please fill all fields')
      return
    }

    const selectedType = sharingTypes.find(t => t.value === roomForm.sharing_type)
    
    const { error } = await supabase.from('rooms').insert({
      property_id: property.id,
      room_number: roomForm.room_number,
      sharing_type: roomForm.sharing_type,
      monthly_rent: roomForm.monthly_rent || selectedType.price,
      capacity: selectedType.capacity,
      current_occupants: 0,
      status: 'vacant'
    })

    if (error) {
      toast.error('Failed to add room')
    } else {
      toast.success(`Room ${roomForm.room_number} (${selectedType.label}) added!`)
      setShowRoomModal(false)
      setRoomForm({ room_number: '', sharing_type: 'double', monthly_rent: 10000 })
      loadData()
    }
  }

  const addTenant = async () => {
    if (!formData.name || !formData.phone || !formData.rent_amount || !formData.room_id) {
      toast.error('Please fill all fields')
      return
    }

    const selectedRoom = rooms.find(r => r.id === formData.room_id)
    
    if (selectedRoom.current_occupants >= selectedRoom.capacity) {
      toast.error(`Room is full! Capacity: ${selectedRoom.capacity} occupants`)
      return
    }

    // Create user for tenant
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        phone: formData.phone,
        email: formData.email,
        full_name: formData.name,
        role: 'tenant'
      })
      .select()
      .single()

    if (userError) {
      // If user exists, get existing user
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('phone', formData.phone)
        .single()
      
      if (existingUser) {
        // Add tenant with existing user
        const { error: tenantError } = await supabase.from('tenants').insert({
          user_id: existingUser.id,
          property_id: property.id,
          room_id: formData.room_id,
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          rent_amount: parseInt(formData.rent_amount),
          rent_status: 'pending',
          move_in_date: new Date().toISOString().split('T')[0]
        })

        if (tenantError) throw tenantError
      } else {
        toast.error('Failed to create tenant user')
        return
      }
    } else {
      // Add tenant with new user
      const { error: tenantError } = await supabase.from('tenants').insert({
        user_id: newUser.id,
        property_id: property.id,
        room_id: formData.room_id,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        rent_amount: parseInt(formData.rent_amount),
        rent_status: 'pending',
        move_in_date: new Date().toISOString().split('T')[0]
      })

      if (tenantError) throw tenantError
    }

    const newOccupants = selectedRoom.current_occupants + 1
    const newStatus = newOccupants >= selectedRoom.capacity ? 'occupied' : 'vacant'
    
    await supabase
      .from('rooms')
      .update({ current_occupants: newOccupants, status: newStatus })
      .eq('id', formData.room_id)
    
    toast.success(`Tenant added to Room ${selectedRoom.room_number} (${newOccupants}/${selectedRoom.capacity} occupants)`)
    setShowAddModal(false)
    setFormData({ name: '', phone: '', email: '', rent_amount: '', room_id: '' })
    loadData()
  }

  const markRentPaid = async () => {
    if (!selectedTenant) return

    const { error } = await supabase
      .from('tenants')
      .update({ rent_status: 'paid', updated_at: new Date() })
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
      const room = rooms.find(r => r.id === roomId)
      const newOccupants = Math.max(0, room.current_occupants - 1)
      const newStatus = newOccupants >= room.capacity ? 'occupied' : 'vacant'
      
      await supabase.from('tenants').delete().eq('id', id)
      await supabase
        .from('rooms')
        .update({ current_occupants: newOccupants, status: newStatus })
        .eq('id', roomId)
      
      toast.success('Tenant removed successfully')
      loadData()
    }
  }

  const deleteRoom = async (id) => {
    const room = rooms.find(r => r.id === id)
    if (room.current_occupants > 0) {
      toast.error(`Cannot delete room with ${room.current_occupants} occupants. Remove tenants first.`)
      return
    }
    if (confirm('Are you sure you want to delete this room?')) {
      await supabase.from('rooms').delete().eq('id', id)
      toast.success('Room deleted successfully')
      loadData()
    }
  }

  const handleLogout = () => {
    localStorage.clear()
    router.push('/')
  }

  const getSharingDetails = (type) => {
    return sharingTypes.find(t => t.value === type) || sharingTypes[0]
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

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="gradient-bg text-white px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">🏠 HOSTELSET</h1>
          <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-lg">Logout</button>
        </nav>
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-6 animate-float">🏠</div>
            <h1 className="text-2xl font-bold mb-4">Welcome to HOSTELSET!</h1>
            <p className="text-gray-500 mb-8">You haven't registered any property yet.</p>
            <Link href="/owner/register-property" className="btn-primary inline-block">
              Register Your First Property →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="gradient-bg text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-lg">
        <Link href="/owner/dashboard" className="text-2xl font-bold">🏠 HOSTELSET</Link>
        <div className="flex items-center gap-4">
          <span className="text-sm hidden md:inline">{property?.name}</span>
          <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600 transition">
            Logout
          </button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Owner Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage your property, rooms, and tenants</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-primary">
            <p className="text-gray-500 text-sm">Total Rooms</p>
            <p className="text-3xl font-bold text-primary">{stats.totalRooms}</p>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-green-500">
            <p className="text-gray-500 text-sm">Full Rooms</p>
            <p className="text-3xl font-bold text-green-600">{stats.occupied}</p>
            <p className="text-xs text-gray-400 mt-1">{stats.totalRooms ? Math.round((stats.occupied/stats.totalRooms)*100) : 0}% occupancy</p>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-orange-500">
            <p className="text-gray-500 text-sm">Available Rooms</p>
            <p className="text-3xl font-bold text-orange-500">{stats.vacant}</p>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-red-500">
            <p className="text-gray-500 text-sm">Pending Rent</p>
            <p className="text-3xl font-bold text-red-600">₹{stats.dueAmount.toLocaleString()}</p>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowAddModal(true)} className="bg-primary text-white p-4 rounded-xl font-semibold shadow-md">
            + Add Tenant
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowRoomModal(true)} className="bg-secondary text-white p-4 rounded-xl font-semibold shadow-md">
            + Add Room
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-green-600 text-white p-4 rounded-xl font-semibold shadow-md">
            💰 Collect Rent
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-purple-600 text-white p-4 rounded-xl font-semibold shadow-md">
            📊 Reports
          </motion.button>
        </div>

        <div className="flex border-b mb-6">
          {['tenants', 'rooms', 'payments'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold capitalize transition-all ${
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">📋 All Tenants</h2>
              <button onClick={() => setShowAddModal(true)} className="text-primary text-sm font-semibold hover:underline">+ Add New</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Phone</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Room</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Sharing</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Rent</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => {
                    const sharingDetails = getSharingDetails(tenant.rooms?.sharing_type)
                    return (
                      <tr key={tenant.id} className="border-b hover:bg-gray-50 transition">
                        <td className="px-6 py-4 font-medium text-gray-800">{tenant.name}</td>
                        <td className="px-6 py-4 text-gray-600">{tenant.phone}</td>
                        <td className="px-6 py-4 text-gray-600">Room {tenant.rooms?.room_number}</td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1">
                            {sharingDetails?.icon} {sharingDetails?.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-800">₹{tenant.rent_amount?.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            tenant.rent_status === 'pending' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {tenant.rent_status === 'pending' ? '⚠️ Due' : '✅ Paid'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {tenant.rent_status === 'pending' && (
                            <button onClick={() => { setSelectedTenant(tenant); setShowRentModal(true) }} className="text-green-600 hover:text-green-800 font-medium mr-4 transition">
                              Mark Paid
                            </button>
                          )}
                          <button onClick={() => deleteTenant(tenant.id, tenant.room_id)} className="text-red-600 hover:text-red-800 font-medium transition">
                            Delete
                          </button>
                         </td>
                       </tr>
                    )
                  })}
                </tbody>
              </table>
              {tenants.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  No tenants yet. Click "Add Tenant" to get started.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => {
                const sharingDetails = getSharingDetails(room.sharing_type)
                const isFull = room.current_occupants >= room.capacity
                const availability = room.capacity - room.current_occupants
                const occupancyPercentage = (room.current_occupants / room.capacity) * 100
                
                return (
                  <motion.div key={room.id} whileHover={{ y: -5 }} className={`border rounded-xl overflow-hidden ${
                    isFull ? 'bg-green-50 border-green-200' : 'bg-white'
                  }`}>
                    <div className={`p-4 ${isFull ? 'bg-green-100' : 'bg-primary/10'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-xl">Room {room.room_number}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {sharingDetails?.icon} {sharingDetails?.label}
                          </p>
                          <p className="text-xs text-gray-500">{sharingDetails?.description}</p>
                        </div>
                        <button onClick={() => deleteRoom(room.id)} className="text-red-500 hover:text-red-700">🗑️</button>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-500">Occupancy:</span>
                        <span className="font-semibold">{room.current_occupants}/{room.capacity}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${occupancyPercentage}%` }}></div>
                      </div>
                      <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-gray-500">Rent per person:</span>
                        <span className="font-bold text-primary">₹{room.monthly_rent.toLocaleString()}/month</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Status:</span>
                        <span className={isFull ? 'text-green-600 font-semibold' : 'text-orange-500 font-semibold'}>
                          {isFull ? '🟢 Full' : `🔴 ${availability} slot(s) available`}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
            {rooms.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                No rooms yet. Click "Add Room" to get started.
              </div>
            )}
          </motion.div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-sm p-6">
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
          </motion.div>
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
                <input type="tel" placeholder="Phone Number (10 digits)" className="input" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} maxLength={10} />
                <input type="email" placeholder="Email (optional)" className="input" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                <input type="number" placeholder="Monthly Rent (₹)" className="input" value={formData.rent_amount} onChange={(e) => setFormData({...formData, rent_amount: e.target.value})} />
                <select className="input" value={formData.room_id} onChange={(e) => setFormData({...formData, room_id: e.target.value})}>
                  <option value="">Select Room</option>
                  {rooms.filter(r => r.current_occupants < r.capacity).map((room) => {
                    const sharingDetails = getSharingDetails(room.sharing_type)
                    const available = room.capacity - room.current_occupants
                    return (
                      <option key={room.id} value={room.id}>
                        Room {room.room_number} - {sharingDetails.label} {sharingDetails.icon} ({available} slots available) - ₹{room.monthly_rent}/month
                      </option>
                    )
                  })}
                </select>
                <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
                  💡 Tenant will be able to login with the phone number provided and see their room details
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={addTenant} className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold">Add Tenant</button>
                  <button onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Room Modal */}
      <AnimatePresence>
        {showRoomModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Add New Room</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Room Number (e.g., 101)" className="input" value={roomForm.room_number} onChange={(e) => setRoomForm({...roomForm, room_number: e.target.value})} />
                <select className="input" value={roomForm.sharing_type} onChange={(e) => {
                  const selected = sharingTypes.find(t => t.value === e.target.value)
                  setRoomForm({
                    ...roomForm,
                    sharing_type: e.target.value,
                    monthly_rent: selected.price
                  })
                }}>
                  {sharingTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label} {type.icon} - {type.description} - ₹{type.price}/month
                    </option>
                  ))}
                </select>
                <input type="number" placeholder="Monthly Rent (₹)" className="input" value={roomForm.monthly_rent} onChange={(e) => setRoomForm({...roomForm, monthly_rent: e.target.value})} />
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-sm text-gray-600">📊 Room Summary:</p>
                  <p className="text-sm font-semibold mt-1">
                    {sharingTypes.find(t => t.value === roomForm.sharing_type)?.label} • 
                    Capacity: {sharingTypes.find(t => t.value === roomForm.sharing_type)?.capacity} persons • 
                    Rent: ₹{roomForm.monthly_rent}/person
                  </p>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={addRoom} className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold">Add Room</button>
                  <button onClick={() => setShowRoomModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
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
              <div className="text-5xl mb-4 animate-float">💰</div>
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
