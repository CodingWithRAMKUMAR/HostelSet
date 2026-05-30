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
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [activeTab, setActiveTab] = useState('tenants')
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', rent_amount: '', room_id: '' })
  const [roomForm, setRoomForm] = useState({ room_number: '', sharing_type: 'double', monthly_rent: 10000 })
  const [paymentAmount, setPaymentAmount] = useState('')
  const [stats, setStats] = useState({ totalRooms: 0, occupied: 0, vacant: 0, dueAmount: 0, monthlyRevenue: 0, totalCollected: 0 })
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    const userId = localStorage.getItem('userId')
    
    if (!isLoggedIn || userRole !== 'owner' || !userId) {
      toast.error('Please login to continue')
      router.push('/login')
      return
    }
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const userId = localStorage.getItem('userId')
      
      if (!userId) {
        throw new Error('User not found. Please login again.')
      }

      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle()

      if (propertyError) {
        console.error('Property fetch error:', propertyError)
        throw new Error('Failed to load property data')
      }

      if (propertyData) {
        setProperty(propertyData)

        const { data: roomsData, error: roomsError } = await supabase
          .from('rooms')
          .select('*')
          .eq('property_id', propertyData.id)
          .order('room_number', { ascending: true })

        if (roomsError) {
          console.error('Rooms fetch error:', roomsError)
        } else if (roomsData) {
          setRooms(roomsData)
          const total = roomsData.length
          const occupied = roomsData.filter(r => r.current_occupants >= r.capacity).length
          const vacant = roomsData.filter(r => r.current_occupants < r.capacity).length
          setStats(prev => ({ ...prev, totalRooms: total, occupied, vacant }))
        }

        const { data: tenantsData, error: tenantsError } = await supabase
          .from('tenants')
          .select('*, rooms:room_id(*)')
          .eq('property_id', propertyData.id)

        if (tenantsError) {
          console.error('Tenants fetch error:', tenantsError)
        } else if (tenantsData) {
          setTenants(tenantsData)
          const due = tenantsData.filter(t => t.rent_status === 'pending').reduce((sum, t) => sum + (t.rent_amount || 0), 0)
          const paid = tenantsData.filter(t => t.rent_status === 'paid').reduce((sum, t) => sum + (t.rent_amount || 0), 0)
          const totalCollected = tenantsData.reduce((sum, t) => sum + (t.total_paid || 0), 0)
          setStats(prev => ({ ...prev, dueAmount: due, monthlyRevenue: paid, totalCollected: totalCollected }))
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error(error.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const addRoom = async () => {
    if (!roomForm.room_number || !roomForm.sharing_type) {
      toast.error('Please fill all fields')
      return
    }

    const roomExists = rooms.some(r => r.room_number === roomForm.room_number)
    if (roomExists) {
      toast.error(`Room ${roomForm.room_number} already exists!`)
      return
    }

    setIsSubmitting(true)
    try {
      const selectedType = sharingTypes.find(t => t.value === roomForm.sharing_type)
      
      const { error } = await supabase.from('rooms').insert({
        property_id: property.id,
        room_number: roomForm.room_number,
        sharing_type: roomForm.sharing_type,
        monthly_rent: parseInt(roomForm.monthly_rent) || selectedType.price,
        capacity: selectedType.capacity,
        current_occupants: 0,
        status: 'vacant'
      })

      if (error) throw error

      toast.success(`Room ${roomForm.room_number} (${selectedType.label}) added!`)
      setShowRoomModal(false)
      setRoomForm({ room_number: '', sharing_type: 'double', monthly_rent: 10000 })
      await loadData()
    } catch (error) {
      console.error('Add room error:', error)
      toast.error(error.message || 'Failed to add room')
    } finally {
      setIsSubmitting(false)
    }
  }

  const addTenant = async () => {
    if (!formData.name || !formData.phone || !formData.rent_amount || !formData.room_id) {
      toast.error('Please fill all fields')
      return
    }

    if (formData.phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number')
      return
    }

    // Check if phone number already exists as a tenant in this property
    const phoneExists = tenants.some(t => t.phone === formData.phone)
    if (phoneExists) {
      toast.error('A tenant with this phone number already exists!')
      return
    }

    const selectedRoom = rooms.find(r => r.id === formData.room_id)
    if (!selectedRoom) {
      toast.error('Selected room not found')
      return
    }
    
    if (selectedRoom.current_occupants >= selectedRoom.capacity) {
      toast.error(`Room is full! Capacity: ${selectedRoom.capacity} occupants`)
      return
    }

    setIsSubmitting(true)
    try {
      // Check if user already exists
      let userId = null
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('phone', formData.phone)
        .maybeSingle()

      if (existingUser) {
        userId = existingUser.id
      } else {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            phone: formData.phone,
            email: formData.email || null,
            full_name: formData.name,
            role: 'tenant',
            is_active: true
          })
          .select()
          .single()

        if (createError) throw createError
        userId = newUser.id
      }

      const { error: tenantError } = await supabase.from('tenants').insert({
        user_id: userId,
        property_id: property.id,
        room_id: formData.room_id,
        name: formData.name,
        phone: formData.phone,
        email: formData.email || null,
        rent_amount: parseInt(formData.rent_amount),
        rent_status: 'pending',
        pending_amount: parseInt(formData.rent_amount),
        total_paid: 0,
        move_in_date: new Date().toISOString().split('T')[0]
      })

      if (tenantError) throw tenantError

      const newOccupants = selectedRoom.current_occupants + 1
      const newStatus = newOccupants >= selectedRoom.capacity ? 'occupied' : 'vacant'
      
      await supabase
        .from('rooms')
        .update({ current_occupants: newOccupants, status: newStatus })
        .eq('id', formData.room_id)

      toast.success(`Tenant added to Room ${selectedRoom.room_number}!`)
      setShowAddModal(false)
      setFormData({ name: '', phone: '', email: '', rent_amount: '', room_id: '' })
      await loadData()
    } catch (error) {
      console.error('Add tenant error:', error)
      toast.error(error.message || 'Failed to add tenant')
    } finally {
      setIsSubmitting(false)
    }
  }

  const collectRent = async () => {
    if (!selectedTenant || !paymentAmount) {
      toast.error('Please enter payment amount')
      return
    }

    const amount = parseInt(paymentAmount)
    if (amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setIsSubmitting(true)
    try {
      // Record payment in payment_history
      const { error: paymentError } = await supabase.from('payment_history').insert({
        tenant_id: selectedTenant.id,
        amount: amount,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        status: 'success'
      })

      if (paymentError) throw paymentError

      // Update tenant's total paid and pending amount
      const newTotalPaid = (selectedTenant.total_paid || 0) + amount
      const newPendingAmount = Math.max(0, (selectedTenant.pending_amount || selectedTenant.rent_amount) - amount)
      const newRentStatus = newPendingAmount <= 0 ? 'paid' : 'pending'

      const { error: updateError } = await supabase
        .from('tenants')
        .update({
          total_paid: newTotalPaid,
          pending_amount: newPendingAmount,
          rent_status: newRentStatus,
          last_payment_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', selectedTenant.id)

      if (updateError) throw updateError

      toast.success(`₹${amount.toLocaleString()} collected from ${selectedTenant.name}`)
      setShowPaymentModal(false)
      setPaymentAmount('')
      await loadData()
    } catch (error) {
      console.error('Collect rent error:', error)
      toast.error(error.message || 'Failed to record payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const markRentPaid = async () => {
    if (!selectedTenant) return

    setIsSubmitting(true)
    try {
      // Record full payment
      const { error: paymentError } = await supabase.from('payment_history').insert({
        tenant_id: selectedTenant.id,
        amount: selectedTenant.rent_amount,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        status: 'success'
      })

      if (paymentError) throw paymentError

      const newTotalPaid = (selectedTenant.total_paid || 0) + selectedTenant.rent_amount

      const { error } = await supabase
        .from('tenants')
        .update({ 
          rent_status: 'paid', 
          pending_amount: 0,
          total_paid: newTotalPaid,
          last_payment_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTenant.id)

      if (error) throw error

      toast.success(`Rent marked as paid for ${selectedTenant.name}`)
      setShowRentModal(false)
      await loadData()
    } catch (error) {
      console.error('Mark rent paid error:', error)
      toast.error(error.message || 'Failed to update rent status')
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteTenant = async (id, roomId) => {
    if (!confirm('⚠️ Are you sure you want to remove this tenant? This action cannot be undone.')) {
      return
    }

    setIsSubmitting(true)
    try {
      const room = rooms.find(r => r.id === roomId)
      if (!room) throw new Error('Room not found')

      const newOccupants = Math.max(0, room.current_occupants - 1)
      const newStatus = newOccupants >= room.capacity ? 'occupied' : 'vacant'
      
      await supabase.from('tenants').delete().eq('id', id)
      await supabase
        .from('rooms')
        .update({ current_occupants: newOccupants, status: newStatus })
        .eq('id', roomId)

      toast.success('Tenant removed successfully')
      await loadData()
    } catch (error) {
      console.error('Delete tenant error:', error)
      toast.error(error.message || 'Failed to remove tenant')
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteRoom = async (id) => {
    const room = rooms.find(r => r.id === id)
    if (!room) return

    if (room.current_occupants > 0) {
      toast.error(`Cannot delete room with ${room.current_occupants} occupants. Remove tenants first.`)
      return
    }

    if (!confirm(`⚠️ Are you sure you want to delete Room ${room.room_number}? This action cannot be undone.`)) {
      return
    }

    setIsSubmitting(true)
    try {
      await supabase.from('rooms').delete().eq('id', id)
      toast.success(`Room ${room.room_number} deleted successfully`)
      await loadData()
    } catch (error) {
      console.error('Delete room error:', error)
      toast.error(error.message || 'Failed to delete room')
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
          <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600 transition">Logout</button>
        </nav>
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-6 animate-float">🏠</div>
            <h1 className="text-2xl font-bold mb-4">Welcome to HOSTELSET!</h1>
            <p className="text-gray-500 mb-8">You haven't registered any property yet.</p>
            <Link href="/owner/register-property" className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-opacity-90 transition inline-block">
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
            <p className="text-gray-500 text-sm">Occupied Rooms</p>
            <p className="text-3xl font-bold text-green-600">{stats.occupied}</p>
            <p className="text-xs text-gray-400 mt-1">{stats.totalRooms ? Math.round((stats.occupied/stats.totalRooms)*100) : 0}% occupancy</p>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-orange-500">
            <p className="text-gray-500 text-sm">Available Rooms</p>
            <p className="text-3xl font-bold text-orange-500">{stats.vacant}</p>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-blue-500">
            <p className="text-gray-500 text-sm">Total Collected</p>
            <p className="text-3xl font-bold text-blue-600">₹{stats.totalCollected.toLocaleString()}</p>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowAddModal(true)} disabled={isSubmitting} className="bg-primary text-white p-4 rounded-xl font-semibold shadow-md disabled:opacity-50">
            + Add Tenant
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowRoomModal(true)} disabled={isSubmitting} className="bg-secondary text-white p-4 rounded-xl font-semibold shadow-md disabled:opacity-50">
            + Add Room
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-green-600 text-white p-4 rounded-xl font-semibold shadow-md">
            💰 Reports
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-purple-600 text-white p-4 rounded-xl font-semibold shadow-md">
            📊 Analytics
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
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Join Date</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Rent</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Paid</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Pending</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.length > 0 ? tenants.map((tenant) => {
                    const sharingDetails = getSharingDetails(tenant.rooms?.sharing_type)
                    return (
                      <tr key={tenant.id} className="border-b hover:bg-gray-50 transition">
                        <td className="px-6 py-4 font-medium text-gray-800">{tenant.name}</td>
                        <td className="px-6 py-4 text-gray-600">{tenant.phone}</td>
                        <td className="px-6 py-4 text-gray-600">Room {tenant.rooms?.room_number} {sharingDetails?.icon}</td>
                        <td className="px-6 py-4 text-gray-600">{new Date(tenant.move_in_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 font-semibold text-gray-800">₹{tenant.rent_amount?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-green-600 font-semibold">₹{(tenant.total_paid || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-red-600 font-semibold">₹{(tenant.pending_amount || tenant.rent_amount).toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => { setSelectedTenant(tenant); setShowPaymentModal(true) }}
                            className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm mr-2 hover:bg-green-700"
                          >
                            Collect Rent
                          </button>
                          <button onClick={() => deleteTenant(tenant.id, tenant.room_id)} className="text-red-600 hover:text-red-800 font-medium transition">
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  }) : (
                    <tr><td colSpan="8" className="text-center py-12 text-gray-400">No tenants yet. Click "Add Tenant" to get started.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.length > 0 ? rooms.map((room) => {
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
              }) : (
                <div className="col-span-full text-center py-12 text-gray-400">No rooms yet. Click "Add Room" to get started.</div>
              )}
            </div>
          </motion.div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">Payment Summary</h2>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-green-600 text-sm">Total Collected</p>
                <p className="text-2xl font-bold text-green-700">₹{stats.totalCollected.toLocaleString()}</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4 text-center">
                <p className="text-yellow-600 text-sm">This Month</p>
                <p className="text-2xl font-bold text-yellow-700">₹{stats.monthlyRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-red-600 text-sm">Pending Collection</p>
                <p className="text-2xl font-bold text-red-700">₹{stats.dueAmount.toLocaleString()}</p>
              </div>
            </div>
            <h3 className="font-semibold mb-3">Recent Transactions</h3>
            <div className="space-y-2">
              {tenants.filter(t => t.last_payment_date).map((tenant) => (
                <div key={tenant.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div><p className="font-medium">{tenant.name}</p><p className="text-xs text-gray-500">Room {tenant.rooms?.room_number}</p></div>
                  <div className="text-right"><p className="font-bold text-green-600">₹{(tenant.total_paid || 0).toLocaleString()}</p><p className="text-xs text-gray-400">Last paid: {tenant.last_payment_date ? new Date(tenant.last_payment_date).toLocaleDateString() : 'Never'}</p></div>
                </div>
              ))}
              {tenants.filter(t => t.last_payment_date).length === 0 && (
                <div className="text-center py-8 text-gray-400">No payments recorded yet</div>
              )}
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
                <div className="flex gap-3 mt-6">
                  <button onClick={addTenant} disabled={isSubmitting} className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold disabled:opacity-50">Add Tenant</button>
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
                  setRoomForm({ ...roomForm, sharing_type: e.target.value, monthly_rent: selected.price })
                }}>
                  {sharingTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label} {type.icon} - {type.description} - ₹{type.price}/month
                    </option>
                  ))}
                </select>
                <input type="number" placeholder="Monthly Rent (₹)" className="input" value={roomForm.monthly_rent} onChange={(e) => setRoomForm({...roomForm, monthly_rent: e.target.value})} />
                <div className="flex gap-3 mt-6">
                  <button onClick={addRoom} disabled={isSubmitting} className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold disabled:opacity-50">Add Room</button>
                  <button onClick={() => setShowRoomModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collect Rent Modal */}
      <AnimatePresence>
        {showPaymentModal && selectedTenant && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Collect Rent</h2>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-gray-600">Tenant: <strong>{selectedTenant.name}</strong></p>
                  <p className="text-gray-600">Room: <strong>{selectedTenant.rooms?.room_number}</strong></p>
                  <p className="text-gray-600">Monthly Rent: <strong>₹{selectedTenant.rent_amount?.toLocaleString()}</strong></p>
                  <p className="text-gray-600">Pending Amount: <strong className="text-red-600">₹{(selectedTenant.pending_amount || selectedTenant.rent_amount).toLocaleString()}</strong></p>
                  <p className="text-gray-600">Total Paid: <strong className="text-green-600">₹{(selectedTenant.total_paid || 0).toLocaleString()}</strong></p>
                </div>
                <input type="number" placeholder="Enter Amount (₹)" className="input" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                <div className="flex gap-3 mt-6">
                  <button onClick={collectRent} disabled={isSubmitting} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">Collect Payment</button>
                  <button onClick={() => { setShowPaymentModal(false); setPaymentAmount('') }} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
