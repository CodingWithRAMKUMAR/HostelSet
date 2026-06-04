import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, uploadImage } from '../../lib/supabase'
import { formatCurrency, formatDate, getSharingDetails, cleanPhoneNumber } from '../../lib/utils'
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
  const [propertyImages, setPropertyImages] = useState([])
  const [uploadingImage, setUploadingImage] = useState(false)
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
        setPropertyImages(propertyData.photos || [])
        
        const { data: roomsData } = await supabase.from('rooms').select('*').eq('property_id', propertyData.id).order('room_number')
        setRooms(roomsData || [])
        
        const total = roomsData?.length || 0
        const occupied = roomsData?.filter(r => r.current_occupants >= r.capacity).length || 0
        const vacant = total - occupied
        setStats({ totalRooms: total, occupied, vacant, totalCollected: 0, pendingAmount: 0 })
        
        const { data: tenantsData } = await supabase
          .from('tenants')
          .select('*, rooms:room_id(*)')
          .eq('property_id', propertyData.id)
        setTenants(tenantsData || [])
        
        const { data: appsData } = await supabase
          .from('applications')
          .select('*')
          .eq('property_id', propertyData.id)
          .eq('status', 'pending')
        setApplications(appsData || [])
        
        const { data: vacateData } = await supabase
          .from('check_out_requests')
          .select('*, tenants:tenant_id(*)')
          .order('created_at', { ascending: false })
        setVacateRequests(vacateData || [])
        
        const { data: noticesData } = await supabase
          .from('notices')
          .select('*')
          .eq('property_id', propertyData.id)
          .order('created_at', { ascending: false })
        setNotices(noticesData || [])
      }
    } catch (error) { 
      console.error('Load error:', error)
      toast.error('Failed to load data')
    } finally { 
      setLoading(false) 
    }
  }

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    
    setUploadingImage(true)
    try {
      const uploadedUrls = []
      for (const file of files) {
        const url = await uploadImage(file, `property-${property.id}`)
        uploadedUrls.push(url)
      }
      
      const newImages = [...propertyImages, ...uploadedUrls]
      const { error } = await supabase
        .from('properties')
        .update({ photos: newImages })
        .eq('id', property.id)
      
      if (error) throw error
      
      setPropertyImages(newImages)
      toast.success(`${uploadedUrls.length} image(s) uploaded successfully!`)
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload images')
    } finally {
      setUploadingImage(false)
    }
  }

  const removeImage = async (imageUrl) => {
    const newImages = propertyImages.filter(img => img !== imageUrl)
    const { error } = await supabase
      .from('properties')
      .update({ photos: newImages })
      .eq('id', property.id)
    
    if (error) {
      toast.error('Failed to remove image')
    } else {
      setPropertyImages(newImages)
      toast.success('Image removed')
    }
  }

  const addRoom = async () => {
    if (!roomForm.room_number) { 
      toast.error('Enter room number')
      return 
    }

    const roomExists = rooms.some(r => r.room_number === roomForm.room_number)
    if (roomExists) {
      toast.error(`❌ Room ${roomForm.room_number} already exists!`)
      return
    }

    setIsSubmitting(true)
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
      toast.success(`✅ Room ${roomForm.room_number} added!`)
      setShowRoomModal(false)
      setRoomForm({ room_number: '', sharing_type: 'double', monthly_rent: 10000 })
      loadData()
    }
    setIsSubmitting(false)
  }

  const addTenant = async () => {
    if (!formData.name || !formData.phone || !formData.rent_amount || !formData.room_id) {
      toast.error('Please fill all fields')
      return
    }

    const cleanPhone = cleanPhoneNumber(formData.phone)
    if (cleanPhone.length !== 10) {
      toast.error('Enter valid 10-digit phone number')
      return
    }

    const selectedRoom = rooms.find(r => r.id === formData.room_id)
    if (!selectedRoom) {
      toast.error('Selected room not found')
      return
    }
    
    if (selectedRoom.current_occupants >= selectedRoom.capacity) {
      toast.error(`Room ${selectedRoom.room_number} is full! Capacity: ${selectedRoom.capacity}`)
      return
    }
    
    setIsSubmitting(true)
    
    try {
      let userId = null
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle()
      
      if (existingUser) {
        userId = existingUser.id
        if (existingUser.role !== 'tenant') {
          await supabase.from('users').update({ role: 'tenant' }).eq('id', userId)
        }
      } else {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({ 
            phone: cleanPhone,
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

      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      
      if (existingTenant) {
        const { error: updateError } = await supabase
          .from('tenants')
          .update({
            property_id: property.id,
            room_id: selectedRoom.id,
            name: formData.name,
            phone: cleanPhone,
            rent_amount: parseInt(formData.rent_amount),
            pending_amount: parseInt(formData.rent_amount),
            status: 'active'
          })
          .eq('id', existingTenant.id)
        
        if (updateError) throw updateError
      } else {
        const { error: tenantError } = await supabase
          .from('tenants')
          .insert({
            user_id: userId,
            property_id: property.id,
            room_id: selectedRoom.id,
            name: formData.name,
            phone: cleanPhone,
            email: formData.email || null,
            rent_amount: parseInt(formData.rent_amount),
            pending_amount: parseInt(formData.rent_amount),
            total_paid: 0,
            rent_status: 'pending',
            move_in_date: new Date().toISOString().split('T')[0],
            status: 'active'
          })

        if (tenantError) throw tenantError
      }

      const newOccupants = selectedRoom.current_occupants + 1
      const newStatus = newOccupants >= selectedRoom.capacity ? 'occupied' : 'vacant'
      
      await supabase
        .from('rooms')
        .update({ 
          current_occupants: newOccupants, 
          status: newStatus 
        })
        .eq('id', selectedRoom.id)

      toast.success(`✅ Tenant "${formData.name}" added to Room ${selectedRoom.room_number}!`)
      toast.success(`📱 Login with: ${cleanPhone} | OTP: 123456`)
      
      setShowAddModal(false)
      setFormData({ name: '', phone: '', email: '', rent_amount: '', room_id: '' })
      await loadData()
      
    } catch (error) {
      console.error('Add tenant error:', error)
      toast.error('Failed to add tenant: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // FIXED: Post Notice with loading state to prevent multiple posts
  const postNotice = async () => {
    if (!noticeForm.title || !noticeForm.content) { 
      toast.error('Fill all fields')
      return 
    }
    
    // Prevent multiple submissions
    if (isSubmitting) return
    
    setIsSubmitting(true)
    
    try {
      const { error } = await supabase.from('notices').insert({ 
        property_id: property.id, 
        title: noticeForm.title, 
        content: noticeForm.content, 
        type: noticeForm.type, 
        is_urgent: noticeForm.is_urgent 
      })
      
      if (error) throw error
      
      toast.success('Notice posted successfully!')
      setShowNoticeModal(false)
      setNoticeForm({ title: '', content: '', type: 'general', is_urgent: false })
      await loadData()
      
    } catch (error) {
      console.error('Post notice error:', error)
      toast.error('Failed to post notice')
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
    
    setIsSubmitting(true)
    
    try {
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
      await loadData()
    } catch (error) {
      toast.error('Failed to collect rent')
    } finally {
      setIsSubmitting(false)
    }
  }

  const approveVacateRequest = async (requestId, tenantId, roomId) => {
    setIsSubmitting(true)
    try {
      await supabase.from('check_out_requests').update({ 
        status: 'approved', 
        processed_at: new Date() 
      }).eq('id', requestId)
      
      await supabase.from('tenants').update({ 
        status: 'checked_out', 
        check_out_requested: true 
      }).eq('id', tenantId)
      
      await supabase.from('rooms').update({ 
        current_occupants: 0, 
        status: 'vacant' 
      }).eq('id', roomId)
      
      toast.success('Vacate request approved. Room is now vacant.')
      await loadData()
    } catch (error) {
      toast.error('Failed to approve request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteTenant = async (id, roomId) => {
    if (!confirm('Remove this tenant?')) return
    const room = rooms.find(r => r.id === roomId)
    const newOccupants = Math.max(0, room.current_occupants - 1)
    
    setIsSubmitting(true)
    try {
      await supabase.from('tenants').delete().eq('id', id)
      await supabase.from('rooms').update({ 
        current_occupants: newOccupants, 
        status: newOccupants >= room.capacity ? 'occupied' : 'vacant' 
      }).eq('id', roomId)
      toast.success('Tenant removed')
      await loadData()
    } catch (error) {
      toast.error('Failed to remove tenant')
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteRoom = async (id) => {
    const room = rooms.find(r => r.id === id)
    if (room.current_occupants > 0) { 
      toast.error(`Cannot delete room with ${room.current_occupants} occupants`)
      return 
    }
    if (!confirm(`Delete Room ${room.room_number}?`)) return
    
    setIsSubmitting(true)
    try {
      await supabase.from('rooms').delete().eq('id', id)
      toast.success('Room deleted')
      await loadData()
    } catch (error) {
      toast.error('Failed to delete room')
    } finally {
      setIsSubmitting(false)
    }
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
    ...vacateRequests.filter(r => r.status === 'pending').map(() => ({ type: 'vacate', message: 'New vacate request' })),
    ...applications.map(() => ({ type: 'application', message: 'New application pending' }))
  ]

  return (
    <div className="min-h-screen" style={{ background: '#0f172a' }}>
      {/* Navbar */}
      <nav className="navbar py-4 px-6 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-primary">🏠 HOSTELSET</h1>
          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">Owner</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm hidden md:inline text-gray-300">{property.name}</span>
          <button onClick={handleLogout} className="text-red-400 hover:text-red-300 transition">Logout</button>
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
              <div key={i} className={`alert-${a.type === 'overdue' ? 'danger' : a.type === 'vacate' ? 'warning' : 'info'} flex items-center gap-2`}>
                <span>{a.type === 'overdue' ? '🔴' : a.type === 'vacate' ? '🟡' : '🔵'}</span>
                {a.message}
              </div>
            ))}
          </div>
        )}
        
        {/* Property Images Section */}
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-4">📸 Property Photos</h2>
          <div className="image-gallery">
            {propertyImages.map((img, i) => (
              <div key={i} className="image-preview group">
                <img src={img} alt={`Property ${i + 1}`} className="w-full h-24 object-cover rounded-lg" />
                <button onClick={() => removeImage(img)} className="remove-image opacity-0 group-hover:opacity-100 transition">✕</button>
              </div>
            ))}
            <label className="image-preview flex items-center justify-center border-2 border-dashed border-gray-600 hover:border-primary cursor-pointer transition">
              <div className="text-center">
                <div className="text-2xl mb-1">📷</div>
                <div className="text-xs text-gray-400">Add Photo</div>
              </div>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
            </label>
          </div>
          {uploadingImage && <div className="text-center text-primary text-sm mt-2">Uploading...</div>}
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm">+ Add Tenant</button>
          <button onClick={() => setShowRoomModal(true)} className="btn-secondary text-sm">+ Add Room</button>
          <button onClick={() => setShowNoticeModal(true)} className="btn-secondary text-sm">📢 Post Notice</button>
        </div>
        
        {/* Tabs */}
        <div className="flex flex-wrap border-b border-gray-800 mb-6 gap-2">
          {['rooms', 'tenants', 'applications', 'vacate', 'notices'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold capitalize transition-all rounded-t-lg ${
                activeTab === tab
                  ? 'bg-primary/10 text-primary border-b-2 border-primary'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              {tab === 'rooms' && '🏠 Rooms'}
              {tab === 'tenants' && '👥 Tenants'}
              {tab === 'applications' && `📋 Applications ${applications.length > 0 && <span className="bg-red-500 text-white rounded-full px-2 text-xs ml-1">{applications.length}</span>}`}
              {tab === 'vacate' && `🚪 Vacate ${vacateRequests.filter(r => r.status === 'pending').length > 0 && <span className="bg-yellow-500 text-white rounded-full px-2 text-xs ml-1">{vacateRequests.filter(r => r.status === 'pending').length}</span>}`}
              {tab === 'notices' && '📢 Notices'}
            </button>
          ))}
        </div>

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div className="room-grid">
            {rooms.map(room => {
              const sharing = getSharingDetails(room.sharing_type)
              const isFull = room.current_occupants >= room.capacity
              const availableSlots = room.capacity - room.current_occupants
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
                      {isFull ? 'Full' : `${availableSlots} slot(s) available`}
                    </span>
                  </div>
                  <div className="progress-bar mt-2">
                    <div className="progress-fill" style={{ width: `${(room.current_occupants/room.capacity)*100}%` }}></div>
                  </div>
                  <button onClick={() => deleteRoom(room.id)} className="btn-danger text-xs mt-3 w-full" disabled={isSubmitting}>Delete Room</button>
                </div>
              )
            })}
            {rooms.length === 0 && <div className="text-center py-12 text-gray-400 col-span-full">No rooms yet. Click "Add Room" to get started.</div>}
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === 'tenants' && (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Phone</th><th>Room</th><th>Rent</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.name}</td>
                    <td>{t.phone}</td>
                    <td>Room {t.rooms?.room_number} ({getSharingDetails(t.rooms?.sharing_type)?.label})</td>
                    <td className="font-semibold text-primary">{formatCurrency(t.rent_amount)}</td>
                    <td><span className="badge-success">✅ Active</span></td>
                    <td>
                      <button onClick={() => { setSelectedTenant(t); setShowPaymentModal(true) }} className="btn-success text-xs mr-2">Collect</button>
                      <button onClick={() => deleteTenant(t.id, t.room_id)} className="btn-danger text-xs" disabled={isSubmitting}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tenants.length === 0 && <div className="text-center py-12 text-gray-400">No tenants yet. Click "Add Tenant" to get started.</div>}
          </div>
        )}

        {/* Applications Tab */}
        {activeTab === 'applications' && (
          <div className="space-y-3">
            {applications.map(app => (
              <div key={app.id} className="card p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold">{app.name}</p>
                  <p className="text-sm text-gray-400">📞 {app.phone}</p>
                  {app.message && <p className="text-xs text-gray-500 mt-1">💬 {app.message}</p>}
                </div>
                <button onClick={() => approveApplication(app.id)} className="btn-success text-sm">Approve</button>
              </div>
            ))}
            {applications.length === 0 && <div className="text-center py-12 text-gray-400">No pending applications</div>}
          </div>
        )}

        {/* Vacate Requests Tab */}
        {activeTab === 'vacate' && (
          <div className="space-y-3">
            {vacateRequests.map(req => (
              <div key={req.id} className={`card p-4 ${req.status === 'pending' ? 'border-l-4 border-l-yellow-500' : req.status === 'approved' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{req.tenant_name}</p>
                    <p className="text-sm text-gray-400">Room {req.room_number}</p>
                    <p className="text-xs text-gray-500 mt-1">Requested: {formatDate(req.requested_date)}</p>
                    <p className="text-xs text-gray-500">Expected Check-Out: {formatDate(req.expected_check_out)}</p>
                    {req.reason && <p className="text-xs text-gray-400 mt-1">Reason: {req.reason}</p>}
                    <p className="text-xs mt-2">
                      Status: 
                      <span className={`ml-1 font-semibold ${
                        req.status === 'pending' ? 'text-yellow-400' : 
                        req.status === 'approved' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {req.status.toUpperCase()}
                      </span>
                    </p>
                  </div>
                  {req.status === 'pending' && (
                    <button onClick={() => approveVacateRequest(req.id, req.tenant_id, req.room_id)} className="btn-primary text-sm" disabled={isSubmitting}>
                      Approve Vacate
                    </button>
                  )}
                </div>
              </div>
            ))}
            {vacateRequests.length === 0 && <div className="text-center py-12 text-gray-400">No vacate requests</div>}
          </div>
        )}

        {/* Notices Tab */}
        {activeTab === 'notices' && (
          <div className="space-y-3">
            <button onClick={() => setShowNoticeModal(true)} className="btn-primary text-sm mb-4">+ Post New Notice</button>
            {notices.map(notice => (
              <div key={notice.id} className={`card p-4 ${notice.is_urgent ? 'border-l-4 border-l-red-500 bg-red-500/5' : ''}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-lg">{notice.title}</p>
                      {notice.is_urgent && <span className="badge-danger text-xs">URGENT</span>}
                      <span className="badge-info text-xs">{notice.type}</span>
                    </div>
                    <p className="text-gray-300">{notice.content}</p>
                    <p className="text-xs text-gray-500 mt-2">Posted: {formatDate(notice.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
            {notices.length === 0 && <div className="text-center py-12 text-gray-400">No notices yet. Click "Post New Notice" to get started.</div>}
          </div>
        )}
      </div>

      {/* Add Tenant Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Add New Tenant</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Full Name *" className="input" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                <input type="tel" placeholder="Phone Number *" className="input" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} maxLength={10} />
                <input type="email" placeholder="Email (optional)" className="input" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                <input type="number" placeholder="Monthly Rent (₹) *" className="input" value={formData.rent_amount} onChange={(e) => setFormData({...formData, rent_amount: e.target.value})} />
                <select className="input" value={formData.room_id} onChange={(e) => setFormData({...formData, room_id: e.target.value})}>
                  <option value="">Select Room</option>
                  {rooms.filter(r => r.current_occupants < r.capacity).map(room => (
                    <option key={room.id} value={room.id}>
                      Room {room.room_number} - {getSharingDetails(room.sharing_type).label} - ₹{formatCurrency(room.monthly_rent)}/month
                    </option>
                  ))}
                </select>
                <div className="flex gap-3 mt-6">
                  <button onClick={addTenant} disabled={isSubmitting} className="btn-primary flex-1">{isSubmitting ? 'Adding...' : 'Add Tenant'}</button>
                  <button onClick={() => setShowAddModal(false)} className="btn-outline flex-1">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Room Modal */}
      <AnimatePresence>
        {showRoomModal && (
          <div className="modal-overlay" onClick={() => setShowRoomModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Add New Room</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Room Number *" className="input" value={roomForm.room_number} onChange={(e) => setRoomForm({...roomForm, room_number: e.target.value})} />
                <select className="input" value={roomForm.sharing_type} onChange={(e) => { 
                  const selected = sharingTypes.find(t => t.value === e.target.value)
                  setRoomForm({...roomForm, sharing_type: e.target.value, monthly_rent: selected.price})
                }}>
                  {sharingTypes.map(type => <option key={type.value} value={type.value}>{type.label} {type.icon} - ₹{formatCurrency(type.price)}/month</option>)}
                </select>
                <input type="number" placeholder="Monthly Rent (₹) *" className="input" value={roomForm.monthly_rent} onChange={(e) => setRoomForm({...roomForm, monthly_rent: e.target.value})} />
                <div className="flex gap-3 mt-6">
                  <button onClick={addRoom} disabled={isSubmitting} className="btn-primary flex-1">{isSubmitting ? 'Adding...' : 'Add Room'}</button>
                  <button onClick={() => setShowRoomModal(false)} className="btn-outline flex-1">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Collect Rent Modal */}
      <AnimatePresence>
        {showPaymentModal && selectedTenant && (
          <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Collect Rent</h2>
              <div className="bg-dark rounded-xl p-4 mb-4">
                <p className="font-semibold">{selectedTenant.name}</p>
                <p className="text-sm text-gray-400">Room {selectedTenant.rooms?.room_number}</p>
                <p>Monthly Rent: {formatCurrency(selectedTenant.rent_amount)}</p>
                <p className="text-red-400">Pending: {formatCurrency(selectedTenant.pending_amount || selectedTenant.rent_amount)}</p>
              </div>
              <input type="number" placeholder="Enter Amount (₹)" className="input" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
              <div className="flex gap-3 mt-6">
                <button onClick={collectRent} disabled={isSubmitting} className="btn-success flex-1">{isSubmitting ? 'Processing...' : 'Collect'}</button>
                <button onClick={() => setShowPaymentModal(false)} className="btn-outline flex-1">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Post Notice Modal - FIXED with loading state */}
      <AnimatePresence>
        {showNoticeModal && (
          <div className="modal-overlay" onClick={() => !isSubmitting && setShowNoticeModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Post Notice</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Title *" className="input" value={noticeForm.title} onChange={(e) => setNoticeForm({...noticeForm, title: e.target.value})} />
                <textarea placeholder="Content *" rows="4" className="input" value={noticeForm.content} onChange={(e) => setNoticeForm({...noticeForm, content: e.target.value})} />
                <select className="input" value={noticeForm.type} onChange={(e) => setNoticeForm({...noticeForm, type: e.target.value})}>
                  <option value="general">General</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="payment">Payment</option>
                  <option value="event">Event</option>
                  <option value="emergency">Emergency</option>
                </select>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={noticeForm.is_urgent} onChange={(e) => setNoticeForm({...noticeForm, is_urgent: e.target.checked})} className="w-4 h-4" />
                  <span className="text-sm">Mark as Urgent</span>
                </label>
                <div className="flex gap-3 mt-6">
                  <button onClick={postNotice} disabled={isSubmitting} className="btn-primary flex-1 disabled:opacity-50">
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Posting...
                      </span>
                    ) : (
                      'Post Notice'
                    )}
                  </button>
                  <button onClick={() => setShowNoticeModal(false)} className="btn-outline flex-1" disabled={isSubmitting}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
