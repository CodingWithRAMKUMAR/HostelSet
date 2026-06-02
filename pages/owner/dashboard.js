import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate, getSharingDetails } from '../../lib/utils'
import toast from 'react-hot-toast'

export default function OwnerDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [property, setProperty] = useState(null)
  const [rooms, setRooms] = useState([])
  const [tenants, setTenants] = useState([])
  const [applications, setApplications] = useState([])
  const [vacateRequests, setVacateRequests] = useState([])
  const [notices, setNotices] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showNoticeModal, setShowNoticeModal] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', rent_amount: '', room_id: '' })
  const [roomForm, setRoomForm] = useState({ room_number: '', sharing_type: 'double', monthly_rent: 10000 })
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', type: 'general', is_urgent: false })
  const [paymentAmount, setPaymentAmount] = useState('')
  const [activeTab, setActiveTab] = useState('rooms')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stats, setStats] = useState({ totalRooms: 0, occupied: 0, vacant: 0, totalCollected: 0, pendingAmount: 0 })

  const sharingTypes = [
    { value: 'single', label: 'Single Sharing', capacity: 1, icon: '👤', price: 15000 },
    { value: 'double', label: 'Double Sharing', capacity: 2, icon: '👥', price: 10000 },
    { value: 'triple', label: 'Triple Sharing', capacity: 3, icon: '👥👤', price: 8000 },
    { value: 'four', label: 'Four Sharing', capacity: 4, icon: '👥👥', price: 7000 },
    { value: 'five', label: 'Five Sharing', capacity: 5, icon: '👥👥👤', price: 6000 },
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
      const { data: propertyData } = await supabase.from('properties').select('*').eq('owner_id', userId).maybeSingle()
      
      if (propertyData) {
        setProperty(propertyData)
        const { data: roomsData } = await supabase.from('rooms').select('*').eq('property_id', propertyData.id).order('room_number')
        setRooms(roomsData || [])
        setStats({ 
          totalRooms: roomsData?.length || 0, 
          occupied: roomsData?.filter(r => r.current_occupants >= r.capacity).length || 0, 
          vacant: roomsData?.filter(r => r.current_occupants < r.capacity).length || 0, 
          totalCollected: 0, 
          pendingAmount: 0 
        })
        
        const { data: tenantsData } = await supabase.from('tenants').select('*, rooms:room_id(*)').eq('property_id', propertyData.id)
        setTenants(tenantsData || [])
        
        const { data: appsData } = await supabase.from('applications').select('*').eq('property_id', propertyData.id).eq('status', 'pending')
        setApplications(appsData || [])
        
        const { data: vacateData } = await supabase.from('check_out_requests').select('*, tenants:tenant_id(*)').eq('status', 'pending')
        setVacateRequests(vacateData || [])
        
        const { data: noticesData } = await supabase.from('notices').select('*').eq('property_id', propertyData.id).order('created_at', { ascending: false })
        setNotices(noticesData || [])
      }
    } catch (error) { 
      console.error(error) 
    } finally { 
      setLoading(false) 
    }
  }

  const addRoom = async () => {
    if (!roomForm.room_number) { 
      toast.error('Enter room number')
      return 
    }
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
    if (error) {
      toast.error('Failed to add room')
    } else { 
      toast.success(`Room ${roomForm.room_number} added!`)
      setShowRoomModal(false)
      setRoomForm({ room_number: '', sharing_type: 'double', monthly_rent: 10000 })
      loadData()
    }
  }

  const addTenant = async () => {
    if (!formData.name || !formData.phone || !formData.rent_amount || !formData.room_id) {
      toast.error('Fill all fields')
      return
    }

    const selectedRoom = rooms.find(r => r.id === formData.room_id)
    if (selectedRoom.current_occupants >= selectedRoom.capacity) {
      toast.error(`Room full! Capacity: ${selectedRoom.capacity}`)
      return
    }
    
    setIsSubmitting(true)
    try {
      let userId = null
      
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('phone', formData.phone)
        .maybeSingle()
      
      if (existingUser) {
        userId = existingUser.id
        toast.custom((t) => (
          <div className="bg-yellow-500 text-white p-3 rounded-lg">User already exists! Adding as tenant to this room.</div>
        ), { duration: 3000 })
      } else {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({ 
            phone: formData.phone, 
            email: formData.email, 
            full_name: formData.name, 
            role: 'tenant',
            is_active: true
          })
          .select()
          .single()
        
        if (createError) throw createError
        userId = newUser.id
        toast.success(`Tenant account created for ${formData.name}! They can now login.`)
      }

      const { error: tenantError } = await supabase
        .from('tenants')
        .insert({
          user_id: userId,
          property_id: property.id,
          room_id: formData.room_id,
          name: formData.name,
          phone: formData.phone,
          email: formData.email || null,
          rent_amount: parseInt(formData.rent_amount),
          pending_amount: parseInt(formData.rent_amount),
          total_paid: 0,
          rent_status: 'pending',
          move_in_date: new Date().toISOString().split('T')[0],
          status: 'active'
        })

      if (tenantError) throw tenantError

      const newOccupants = selectedRoom.current_occupants + 1
      const newStatus = newOccupants >= selectedRoom.capacity ? 'occupied' : 'vacant'
      
      await supabase
        .from('rooms')
        .update({ current_occupants: newOccupants, status: newStatus })
        .eq('id', formData.room_id)

      toast.success(`Tenant added to Room ${selectedRoom.room_number}! They can now login with phone: ${formData.phone}`)
      setShowAddModal(false)
      setFormData({ name: '', phone: '', email: '', rent_amount: '', room_id: '' })
      loadData()
    } catch (error) {
      console.error('Add tenant error:', error)
      toast.error('Failed to add tenant')
    } finally {
      setIsSubmitting(false)
    }
  }

  const collectRent = async () => {
    if (!selectedTenant || !paymentAmount) { 
      toast.error('Enter amount')
      return 
    }
    const amount = parseInt(paymentAmount)
    const maxAmount = selectedTenant.pending_amount || selectedTenant.rent_amount
    if (amount > maxAmount) { 
      toast.error(`Amount exceeds pending: ₹${maxAmount.toLocaleString()}`)
      return 
    }
    
    await supabase.from('payment_history').insert({ 
      tenant_id: selectedTenant.id, 
      amount, 
      payment_date: new Date().toISOString().split('T')[0], 
      payment_method: 'cash' 
    })
    const newTotalPaid = (selectedTenant.total_paid || 0) + amount
    const newPendingAmount = maxAmount - amount
    await supabase.from('tenants').update({ 
      total_paid: newTotalPaid, 
      pending_amount: newPendingAmount, 
      rent_status: newPendingAmount <= 0 ? 'paid' : 'pending', 
      last_payment_date: new Date().toISOString().split('T')[0] 
    }).eq('id', selectedTenant.id)
    toast.success(`₹${amount.toLocaleString()} collected from ${selectedTenant.name}`)
    setShowPaymentModal(false)
    setPaymentAmount('')
    loadData()
  }

  const approveApplication = async (appId) => {
    await supabase.from('applications').update({ status: 'approved', processed_at: new Date() }).eq('id', appId)
    toast.success('Application approved! Tenant can now login.')
    loadData()
  }

  const approveVacateRequest = async (requestId, tenantId, roomId) => {
    await supabase.from('check_out_requests').update({ status: 'approved', processed_at: new Date() }).eq('id', requestId)
    await supabase.from('tenants').update({ status: 'checked_out', check_out_requested: true }).eq('id', tenantId)
    await supabase.from('rooms').update({ current_occupants: 0, status: 'vacant' }).eq('id', roomId)
    toast.success('Vacate request approved. Room is now vacant.')
    loadData()
  }

  const postNotice = async () => {
    if (!noticeForm.title || !noticeForm.content) { 
      toast.error('Fill all fields')
      return 
    }
    const { error } = await supabase.from('notices').insert({ 
      property_id: property.id, 
      title: noticeForm.title, 
      content: noticeForm.content, 
      type: noticeForm.type, 
      is_urgent: noticeForm.is_urgent 
    })
    if (error) {
      toast.error('Failed to post notice')
    } else { 
      toast.success('Notice posted!')
      setShowNoticeModal(false)
      setNoticeForm({ title: '', content: '', type: 'general', is_urgent: false })
      loadData()
    }
  }

  const deleteTenant = async (id, roomId) => {
    if (!confirm('Remove this tenant?')) return
    const room = rooms.find(r => r.id === roomId)
    const newOccupants = Math.max(0, room.current_occupants - 1)
    await supabase.from('tenants').delete().eq('id', id)
    await supabase.from('rooms').update({ 
      current_occupants: newOccupants, 
      status: newOccupants >= room.capacity ? 'occupied' : 'vacant' 
    }).eq('id', roomId)
    toast.success('Tenant removed')
    loadData()
  }

  const deleteRoom = async (id) => {
    const room = rooms.find(r => r.id === id)
    if (room.current_occupants > 0) { 
      toast.error(`Cannot delete room with ${room.current_occupants} occupants`)
      return 
    }
    if (!confirm(`Delete Room ${room.room_number}?`)) return
    await supabase.from('rooms').delete().eq('id', id)
    toast.success('Room deleted')
    loadData()
  }

  const handleLogout = () => { 
    localStorage.clear()
    router.push('/') 
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
      <div className="spinner"></div>
    </div>
  )
  
  if (!property) return (
    <div className="min-h-screen" style={{ background: '#0f172a' }}>
      <nav className="navbar py-4 px-6 flex justify-between">
        <h1 className="text-2xl font-bold text-primary">🏠 HOSTELSET</h1>
        <button onClick={handleLogout} className="text-red-500">Logout</button>
      </nav>
      <div className="text-center py-20">
        <div className="text-6xl mb-6">🏠</div>
        <h1 className="text-2xl font-bold mb-4">Welcome to HOSTELSET!</h1>
        <Link href="/owner/register-property" className="btn-primary">Register Your First Property →</Link>
      </div>
    </div>
  )

  const alerts = [
    ...tenants.filter(t => t.rent_status === 'pending' && new Date() > new Date(t.move_in_date).setDate(property.rent_due_day || 5)).map(t => ({ type: 'overdue', message: `${t.name} has overdue rent` })),
    ...vacateRequests.map(() => ({ type: 'vacate', message: 'New vacate request' })),
    ...applications.map(() => ({ type: 'application', message: 'New application pending' }))
  ]

  return (
    <div className="min-h-screen" style={{ background: '#0f172a' }}>
      <nav className="navbar py-4 px-6 flex justify-between items-center sticky top-0 z-50">
        <h1 className="text-2xl font-bold text-primary">🏠 HOSTELSET</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm hidden md:inline">{property.name}</span>
          <button onClick={handleLogout} className="text-red-500 hover:text-red-700">Logout</button>
        </div>
      </nav>
      
      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="stat-card"><div className="stat-number">{stats.totalRooms}</div><div className="stat-label">Total Rooms</div></div>
          <div className="stat-card"><div className="stat-number text-green-400">{stats.occupied}</div><div className="stat-label">Occupied</div></div>
          <div className="stat-card"><div className="stat-number text-orange-400">{stats.vacant}</div><div className="stat-label">Available</div></div>
          <div className="stat-card"><div className="stat-number text-blue-400">₹{stats.totalCollected.toLocaleString()}</div><div className="stat-label">Collected</div></div>
        </div>
        
        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="mb-8 space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className={`alert-${a.type === 'overdue' ? 'danger' : a.type === 'vacate' ? 'warning' : 'info'}`}>
                {a.message}
              </div>
            ))}
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm">+ Add Tenant</button>
          <button onClick={() => setShowRoomModal(true)} className="btn-secondary text-sm">+ Add Room</button>
          <button onClick={() => setShowNoticeModal(true)} className="btn-secondary text-sm">📢 Post Notice</button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-800 mb-6 overflow-x-auto">
          <button onClick={() => setActiveTab('rooms')} className={`px-6 py-3 font-semibold ${activeTab === 'rooms' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}>🏠 Rooms</button>
          <button onClick={() => setActiveTab('tenants')} className={`px-6 py-3 font-semibold ${activeTab === 'tenants' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}>👥 Tenants</button>
          <button onClick={() => setActiveTab('applications')} className={`px-6 py-3 font-semibold ${activeTab === 'applications' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}>📋 Applications {applications.length > 0 && <span className="bg-red-500 text-white rounded-full px-2 text-xs ml-1">{applications.length}</span>}</button>
          <button onClick={() => setActiveTab('vacate')} className={`px-6 py-3 font-semibold ${activeTab === 'vacate' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}>🚪 Vacate {vacateRequests.length > 0 && <span className="bg-yellow-500 text-white rounded-full px-2 text-xs ml-1">{vacateRequests.length}</span>}</button>
          <button onClick={() => setActiveTab('notices')} className={`px-6 py-3 font-semibold ${activeTab === 'notices' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}>📢 Notices</button>
        </div>

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div className="room-grid">
            {rooms.map(room => {
              const sharing = getSharingDetails(room.sharing_type)
              const isFull = room.current_occupants >= room.capacity
              return (
                <div key={room.id} className={`room-card ${isFull ? 'room-card-full' : 'room-card-vacant'}`}>
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-bold">Room {room.room_number}</h3>
                    <span className="text-2xl">{sharing.icon}</span>
                  </div>
                  <p className="text-sm text-gray-400">{sharing.label}</p>
                  <p className="text-lg font-bold text-primary mt-2">{formatCurrency(room.monthly_rent)}<span className="text-xs">/month</span></p>
                  <div className="mt-2 flex justify-between text-sm">
                    <span>👥 {room.current_occupants}/{room.capacity}</span>
                    <span className={isFull ? 'text-red-400' : 'text-green-400'}>
                      {isFull ? 'Full' : `${room.capacity - room.current_occupants} slots`}
                    </span>
                  </div>
                  <div className="progress-bar mt-2">
                    <div className="progress-fill" style={{ width: `${(room.current_occupants/room.capacity)*100}%` }}></div>
                  </div>
                  <button onClick={() => deleteRoom(room.id)} className="btn-danger text-xs mt-3 w-full">Delete Room</button>
                </div>
              )
            })}
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === 'tenants' && (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th><th>Phone</th><th>Room</th><th>Joined</th><th>Rent</th><th>Paid</th><th>Pending</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.phone}</td>
                    <td>Room {t.rooms?.room_number}</td>
                    <td>{formatDate(t.move_in_date)}</td>
                    <td>{formatCurrency(t.rent_amount)}</td>
                    <td className="text-green-400">{formatCurrency(t.total_paid || 0)}</td>
                    <td className="text-red-400">{formatCurrency(t.pending_amount || t.rent_amount)}</td>
                    <td>
                      <button onClick={() => { setSelectedTenant(t); setShowPaymentModal(true) }} className="btn-success text-xs mr-2">Collect</button>
                      <button onClick={() => deleteTenant(t.id, t.room_id)} className="btn-danger text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Applications Tab */}
        {activeTab === 'applications' && (
          <div className="space-y-3">
            {applications.map(app => (
              <div key={app.id} className="card p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold">{app.name}</p>
                  <p className="text-sm text-gray-400">{app.phone} • {app.email}</p>
                  <p className="text-xs text-gray-500">{app.message}</p>
                </div>
                <button onClick={() => approveApplication(app.id)} className="btn-success text-sm">Approve</button>
              </div>
            ))}
            {applications.length === 0 && <div className="text-center py-8 text-gray-500">No pending applications</div>}
          </div>
        )}

        {/* Vacate Requests Tab */}
        {activeTab === 'vacate' && (
          <div className="space-y-3">
            {vacateRequests.map(req => (
              <div key={req.id} className="card p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold">{req.tenant_name}</p>
                  <p className="text-sm text-gray-400">Room {req.room_number} • Expected: {formatDate(req.expected_check_out)}</p>
                  <p className="text-xs text-gray-500">Reason: {req.reason || 'Not specified'}</p>
                </div>
                <button onClick={() => approveVacateRequest(req.id, req.tenant_id, req.room_id)} className="btn-primary text-sm">Approve</button>
              </div>
            ))}
            {vacateRequests.length === 0 && <div className="text-center py-8 text-gray-500">No vacate requests</div>}
          </div>
        )}

        {/* Notices Tab */}
        {activeTab === 'notices' && (
          <div className="space-y-3">
            {notices.map(notice => (
              <div key={notice.id} className={`card p-4 ${notice.is_urgent ? 'border-l-4 border-l-red-500' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{notice.title}</p>
                    <p className="text-sm text-gray-400 mt-1">{notice.content}</p>
                    <p className="text-xs text-gray-500 mt-2">{formatDate(notice.created_at)}</p>
                  </div>
                  <span className={`badge-${notice.is_urgent ? 'danger' : 'info'}`}>{notice.type}</span>
                </div>
              </div>
            ))}
            {notices.length === 0 && <div className="text-center py-8 text-gray-500">No notices yet</div>}
          </div>
        )}
      </div>

      {/* Add Tenant Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="text-2xl font-bold mb-4">Add Tenant</h2>
            <div className="space-y-4">
              <input type="text" placeholder="Full Name" className="input" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              <input type="tel" placeholder="Phone Number" className="input" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              <input type="email" placeholder="Email" className="input" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              <input type="number" placeholder="Monthly Rent" className="input" value={formData.rent_amount} onChange={(e) => setFormData({...formData, rent_amount: e.target.value})} />
              <select className="input" value={formData.room_id} onChange={(e) => setFormData({...formData, room_id: e.target.value})}>
                <option value="">Select Room</option>
                {rooms.filter(r => r.current_occupants < r.capacity).map(room => (
                  <option key={room.id} value={room.id}>Room {room.room_number} - {getSharingDetails(room.sharing_type).label} - {formatCurrency(room.monthly_rent)}</option>
                ))}
              </select>
              <div className="flex gap-3 mt-6">
                <button onClick={addTenant} className="btn-primary flex-1">Add</button>
                <button onClick={() => setShowAddModal(false)} className="btn-outline flex-1">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Room Modal */}
      {showRoomModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="text-2xl font-bold mb-4">Add Room</h2>
            <div className="space-y-4">
              <input type="text" placeholder="Room Number" className="input" value={roomForm.room_number} onChange={(e) => setRoomForm({...roomForm, room_number: e.target.value})} />
              <select className="input" value={roomForm.sharing_type} onChange={(e) => { 
                const selected = sharingTypes.find(t => t.value === e.target.value)
                setRoomForm({...roomForm, sharing_type: e.target.value, monthly_rent: selected.price})
              }}>
                {sharingTypes.map(type => <option key={type.value} value={type.value}>{type.label} {type.icon} - {formatCurrency(type.price)}</option>)}
              </select>
              <input type="number" placeholder="Monthly Rent" className="input" value={roomForm.monthly_rent} onChange={(e) => setRoomForm({...roomForm, monthly_rent: e.target.value})} />
              <div className="flex gap-3 mt-6">
                <button onClick={addRoom} className="btn-primary flex-1">Add</button>
                <button onClick={() => setShowRoomModal(false)} className="btn-outline flex-1">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collect Rent Modal */}
      {showPaymentModal && selectedTenant && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="text-2xl font-bold mb-4">Collect Rent</h2>
            <div className="bg-dark rounded-xl p-4 mb-4">
              <p><strong>{selectedTenant.name}</strong></p>
              <p>Room {selectedTenant.rooms?.room_number}</p>
              <p>Monthly Rent: {formatCurrency(selectedTenant.rent_amount)}</p>
              <p>Pending: {formatCurrency(selectedTenant.pending_amount || selectedTenant.rent_amount)}</p>
            </div>
            <input type="number" placeholder="Amount" className="input" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            <div className="flex gap-3 mt-6">
              <button onClick={collectRent} className="btn-success flex-1">Collect</button>
              <button onClick={() => setShowPaymentModal(false)} className="btn-outline flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Post Notice Modal */}
      {showNoticeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="text-2xl font-bold mb-4">Post Notice</h2>
            <div className="space-y-4">
              <input type="text" placeholder="Title" className="input" value={noticeForm.title} onChange={(e) => setNoticeForm({...noticeForm, title: e.target.value})} />
              <textarea placeholder="Content" rows="4" className="input" value={noticeForm.content} onChange={(e) => setNoticeForm({...noticeForm, content: e.target.value})} />
              <select className="input" value={noticeForm.type} onChange={(e) => setNoticeForm({...noticeForm, type: e.target.value})}>
                <option value="general">General</option>
                <option value="maintenance">Maintenance</option>
                <option value="payment">Payment</option>
                <option value="event">Event</option>
                <option value="emergency">Emergency</option>
              </select>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={noticeForm.is_urgent} onChange={(e) => setNoticeForm({...noticeForm, is_urgent: e.target.checked})} /> Mark as Urgent
              </label>
              <div className="flex gap-3 mt-6">
                <button onClick={postNotice} className="btn-primary flex-1">Post Notice</button>
                <button onClick={() => setShowNoticeModal(false)} className="btn-outline flex-1">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
