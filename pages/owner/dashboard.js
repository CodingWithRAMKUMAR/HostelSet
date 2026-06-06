import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, uploadImage } from '../../lib/supabase'
import { formatCurrency, formatDate, getSharingDetails, cleanPhoneNumber, getDaysOverdue } from '../../lib/utils'
import toast from 'react-hot-toast'

export default function OwnerDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [property, setProperty] = useState(null)
  const [rooms, setRooms] = useState([])
  const [tenants, setTenants] = useState([])
  const [applications, setApplications] = useState([])
  const [vacateRequests, setVacateRequests] = useState([])
  const [complaints, setComplaints] = useState([])
  const [notices, setNotices] = useState([])
  const [propertyImages, setPropertyImages] = useState([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showNoticeModal, setShowNoticeModal] = useState(false)
  const [showRoomDetailsModal, setShowRoomDetailsModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [selectedComplaint, setSelectedComplaint] = useState(null)
  const [showComplaintResponseModal, setShowComplaintResponseModal] = useState(false)
  const [complaintResponse, setComplaintResponse] = useState('')
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', rent_amount: '', room_id: '' })
  const [roomForm, setRoomForm] = useState({ room_number: '', sharing_type: 'double', monthly_rent: 10000 })
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', type: 'general', is_urgent: false })
  const [paymentAmount, setPaymentAmount] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stats, setStats] = useState({ totalRooms: 0, occupied: 0, vacant: 0, totalCollected: 0, pendingAmount: 0, totalComplaints: 0, pendingVacate: 0 })

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
        
        const { data: tenantsData } = await supabase
          .from('tenants')
          .select('*, rooms:room_id(*)')
          .eq('property_id', propertyData.id)
        setTenants(tenantsData || [])
        
        // Calculate total collected from payment_history
        let totalCollected = 0
        if (tenantsData && tenantsData.length > 0) {
          for (const tenant of tenantsData) {
            const { data: payments } = await supabase
              .from('payment_history')
              .select('amount')
              .eq('tenant_id', tenant.id)
            if (payments) {
              totalCollected += payments.reduce((sum, p) => sum + p.amount, 0)
            }
          }
        }
        
        const pendingAmount = tenantsData?.reduce((sum, t) => sum + (t.pending_amount || t.rent_amount), 0) || 0
        
        setStats({ 
          totalRooms: total, 
          occupied, 
          vacant, 
          totalCollected, 
          pendingAmount,
          totalComplaints: 0,
          pendingVacate: 0
        })
        
        const { data: appsData } = await supabase
          .from('applications')
          .select('*')
          .eq('property_id', propertyData.id)
          .eq('status', 'pending')
        setApplications(appsData || [])
        
        const { data: vacateData } = await supabase
          .from('check_out_requests')
          .select('*, tenants:tenant_id(*)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
        setVacateRequests(vacateData || [])
        setStats(prev => ({ ...prev, pendingVacate: vacateData?.length || 0 }))
        
        const { data: complaintsData } = await supabase
          .from('complaints')
          .select('*, tenants:tenant_id(*)')
          .eq('property_id', propertyData.id)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
        setComplaints(complaintsData || [])
        setStats(prev => ({ ...prev, totalComplaints: complaintsData?.length || 0 }))
        
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

  const getTenantsInRoom = (roomId) => {
    return tenants.filter(t => t.room_id === roomId)
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

  // FIXED: Post Notice function - Now working
  const postNotice = async () => {
    if (!noticeForm.title || !noticeForm.content) { 
      toast.error('Please fill both title and content')
      return 
    }
    
    if (isSubmitting) return
    
    setIsSubmitting(true)
    
    try {
      const { data, error } = await supabase.from('notices').insert({ 
        property_id: property.id, 
        title: noticeForm.title, 
        content: noticeForm.content, 
        type: noticeForm.type, 
        is_urgent: noticeForm.is_urgent 
      }).select()
      
      if (error) {
        console.error('Post notice error:', error)
        throw error
      }
      
      console.log('Notice posted:', data)
      toast.success('Notice posted successfully!')
      setShowNoticeModal(false)
      setNoticeForm({ title: '', content: '', type: 'general', is_urgent: false })
      await loadData()
      
    } catch (error) {
      console.error('Post notice error:', error)
      toast.error('Failed to post notice: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // FIXED: Collect Rent function - Updates stats correctly
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
      // Insert payment record
      const { error: paymentError } = await supabase.from('payment_history').insert({ 
        tenant_id: selectedTenant.id, 
        amount: amount, 
        payment_date: new Date().toISOString().split('T')[0], 
        payment_method: 'cash',
        status: 'success'
      })

      if (paymentError) throw paymentError

      // Update tenant's total_paid and pending_amount
      const newTotalPaid = (selectedTenant.total_paid || 0) + amount
      const newPendingAmount = maxAmount - amount
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
      toast.error('Failed to collect rent: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const respondToComplaint = async () => {
    if (!selectedComplaint) return
    
    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('complaints')
        .update({
          status: 'in_progress',
          admin_response: complaintResponse
        })
        .eq('id', selectedComplaint.id)
      
      if (error) throw error
      
      toast.success('Response sent to tenant')
      setShowComplaintResponseModal(false)
      setComplaintResponse('')
      await loadData()
    } catch (error) {
      toast.error('Failed to send response')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resolveComplaint = async (complaintId) => {
    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('complaints')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', complaintId)
      
      if (error) throw error
      
      toast.success('Complaint marked as resolved')
      await loadData()
    } catch (error) {
      toast.error('Failed to resolve complaint')
    } finally {
      setIsSubmitting(false)
    }
  }

  const approveVacateRequest = async (requestId, tenantId, roomId) => {
    setIsSubmitting(true)
    try {
      await supabase.from('check_out_requests').update({ 
        status: 'approved', 
        processed_at: new Date(),
        owner_notes: 'Vacation approved. Please clear all dues.'
      }).eq('id', requestId)
      
      await supabase.from('tenants').update({ 
        status: 'notice_period', 
        check_out_requested: true,
        notice_period_start: new Date().toISOString().split('T')[0],
        notice_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }).eq('id', tenantId)
      
      toast.success('Vacate request approved. Tenant will be notified.')
      await loadData()
    } catch (error) {
      toast.error('Failed to approve request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const approveApplication = async (appId) => {
    setIsSubmitting(true)
    try {
      const { data: app } = await supabase.from('applications').select('*').eq('id', appId).single()
      
      const { data: room } = await supabase.from('rooms').select('*').eq('id', app.room_id).single()
      
      // Check if user exists
      let userId = null
      const { data: existingUser } = await supabase.from('users').select('id').eq('phone', app.phone).maybeSingle()
      
      if (existingUser) {
        userId = existingUser.id
      } else {
        const { data: newUser } = await supabase.from('users').insert({
          phone: app.phone,
          email: app.email,
          full_name: app.name,
          role: 'tenant',
          is_active: true
        }).select().single()
        userId = newUser.id
      }

      // Add tenant
      await supabase.from('tenants').insert({
        user_id: userId,
        property_id: app.property_id,
        room_id: app.room_id,
        name: app.name,
        phone: app.phone,
        email: app.email,
        rent_amount: room.monthly_rent,
        pending_amount: room.monthly_rent,
        total_paid: 0,
        rent_status: 'pending',
        move_in_date: app.expected_move_in || new Date().toISOString().split('T')[0],
        status: 'active'
      })

      // Update room occupancy
      const newOccupants = (room.current_occupants || 0) + 1
      await supabase
        .from('rooms')
        .update({ 
          current_occupants: newOccupants, 
          status: newOccupants >= room.capacity ? 'occupied' : 'vacant' 
        })
        .eq('id', app.room_id)

      // Update application status
      await supabase
        .from('applications')
        .update({ status: 'approved', processed_at: new Date() })
        .eq('id', appId)

      toast.success('Application approved! Tenant can now login.')
      await loadData()
    } catch (error) {
      console.error('Approve error:', error)
      toast.error('Failed to approve application')
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
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    </div>
  )
  
  if (!property) return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">🏠 HOSTELSET</h1>
        <button onClick={handleLogout} className="text-red-500">Logout</button>
      </nav>
      <div className="text-center py-20">
        <div className="text-6xl mb-6">🏠</div>
        <h1 className="text-2xl font-bold mb-4">Welcome to HOSTELSET!</h1>
        <Link href="/owner/register-property" className="bg-slate-800 text-white px-6 py-3 rounded-full font-semibold hover:bg-slate-700 transition">
          Register Your First Property →
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 px-6 py-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">🏠 HOSTELSET</h1>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Owner</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm hidden md:inline text-gray-500">{property.name}</span>
            <button onClick={handleLogout} className="text-red-500 hover:text-red-600 transition">Logout</button>
          </div>
        </div>
      </nav>
      
      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-2xl font-bold text-slate-800">{stats.totalRooms}</div>
            <div className="text-xs text-gray-500">Total Rooms</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.occupied}</div>
            <div className="text-xs text-gray-500">Occupied</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-2xl font-bold text-orange-500">{stats.vacant}</div>
            <div className="text-xs text-gray-500">Available</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-2xl font-bold text-blue-600">₹{stats.totalCollected.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Collected</div>
          </div>
        </div>
        
        {/* Property Photos Section */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">📸 Property Photos</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {propertyImages.map((img, i) => (
              <div key={i} className="relative group">
                <img src={img} alt={`Property ${i + 1}`} className="w-full h-24 object-cover rounded-lg" />
                <button onClick={() => removeImage(img)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 text-sm opacity-0 group-hover:opacity-100 transition">✕</button>
              </div>
            ))}
            <label className="border-2 border-dashed border-gray-300 rounded-lg h-24 flex items-center justify-center cursor-pointer hover:border-slate-400 transition">
              <div className="text-center"><div className="text-2xl mb-1">📷</div><div className="text-xs text-gray-400">Add Photo</div></div>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
            </label>
          </div>
          {uploadingImage && <div className="text-center text-slate-600 text-sm mt-2">Uploading...</div>}
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button onClick={() => setShowAddModal(true)} className="bg-slate-800 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-slate-700 transition">+ Add Tenant</button>
          <button onClick={() => setShowRoomModal(true)} className="border-2 border-slate-300 text-slate-700 px-5 py-2 rounded-full text-sm font-semibold hover:bg-slate-50 transition">+ Add Room</button>
          <button onClick={() => setShowNoticeModal(true)} className="border-2 border-slate-300 text-slate-700 px-5 py-2 rounded-full text-sm font-semibold hover:bg-slate-50 transition">📢 Post Notice</button>
        </div>
        
        {/* Tabs */}
        <div className="flex flex-wrap border-b border-gray-200 mb-6 gap-2">
          {['overview', 'rooms', 'tenants', 'complaints', 'vacate', 'applications', 'notices'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2 text-sm font-semibold capitalize transition-all rounded-t-lg ${activeTab === tab ? 'bg-slate-800 text-white' : 'text-gray-500 hover:text-slate-700 hover:bg-gray-50'}`}>
              {tab === 'overview' && '📊 Overview'}
              {tab === 'rooms' && `🏠 Rooms`}
              {tab === 'tenants' && '👥 Tenants'}
              {tab === 'complaints' && `🔧 Complaints ${stats.totalComplaints > 0 ? `(${stats.totalComplaints})` : ''}`}
              {tab === 'vacate' && `🚪 Vacate ${stats.pendingVacate > 0 ? `(${stats.pendingVacate})` : ''}`}
              {tab === 'applications' && `📋 Applications ${applications.length > 0 ? `(${applications.length})` : ''}`}
              {tab === 'notices' && '📢 Notices'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Recent Tenants</h3>
              <div className="space-y-3">
                {tenants.slice(0, 5).map(t => (
                  <div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div><p className="font-medium text-slate-700">{t.name}</p><p className="text-xs text-gray-400">Room {t.rooms?.room_number}</p></div>
                    <div className="text-right"><p className="font-semibold text-slate-700">{formatCurrency(t.rent_amount)}</p><p className="text-xs text-gray-400">Since {formatDate(t.move_in_date)}</p></div>
                  </div>
                ))}
                {tenants.length === 0 && <p className="text-gray-400 text-center py-4">No tenants yet</p>}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Recent Complaints</h3>
              <div className="space-y-3">
                {complaints.slice(0, 5).map(c => (
                  <div key={c.id} className="p-3 bg-orange-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div><p className="font-medium text-orange-700">{c.title}</p><p className="text-xs text-gray-500 mt-1">From: {c.tenant_name} • Room {c.room_number}</p></div>
                      <button onClick={() => { setSelectedComplaint(c); setShowComplaintResponseModal(true) }} className="text-xs bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700">Respond</button>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{c.description.substring(0, 100)}...</p>
                  </div>
                ))}
                {complaints.length === 0 && <p className="text-gray-400 text-center py-4">No complaints yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => {
              const sharing = getSharingDetails(room.sharing_type)
              const isFull = room.current_occupants >= room.capacity
              const availableSlots = room.capacity - room.current_occupants
              const roomTenants = getTenantsInRoom(room.id)
              return (
                <div key={room.id} onClick={() => { setSelectedRoom(room); setShowRoomDetailsModal(true) }} className={`bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100 overflow-hidden ${isFull ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-gradient-to-br from-slate-50 to-gray-50'}`}>
                  <div className="p-5">
                    <div className="flex justify-between items-start">
                      <div><h3 className="text-2xl font-bold text-slate-800">Room {room.room_number}</h3><p className="text-sm text-gray-500 mt-1">{sharing.label} {sharing.icon}</p></div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${isFull ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>{isFull ? 'Full' : `${availableSlots} slot available`}</div>
                    </div>
                    <div className="mt-4"><p className="text-2xl font-bold text-slate-800">{formatCurrency(room.monthly_rent)}<span className="text-sm text-gray-400">/month</span></p></div>
                    <div className="mt-4"><div className="flex justify-between text-sm mb-1"><span className="text-gray-500">Occupancy</span><span className="text-slate-600">{room.current_occupants}/{room.capacity}</span></div><div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"><div className="h-2 rounded-full bg-gradient-to-r from-slate-600 to-slate-500" style={{ width: `${(room.current_occupants / room.capacity) * 100}%` }}></div></div></div>
                    {roomTenants.length > 0 && (<div className="mt-4 pt-3 border-t border-gray-200"><p className="text-xs text-gray-500 mb-2">Current Residents:</p><div className="flex -space-x-2">{roomTenants.slice(0, 3).map((tenant, idx) => (<div key={tenant.id} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 border-2 border-white">{tenant.name.charAt(0)}</div>))}{roomTenants.length > 3 && (<div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold text-slate-700 border-2 border-white">+{roomTenants.length - 3}</div>)}</div></div>)}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === 'tenants' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b"><tr><th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Name</th><th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Phone</th><th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Room</th><th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Rent</th><th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Paid</th><th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Pending</th><th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Actions</th></tr></thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{t.name}</td>
                    <td className="px-4 py-3 text-gray-500">{t.phone}</td>
                    <td className="px-4 py-3">Room {t.rooms?.room_number}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{formatCurrency(t.rent_amount)}</td>
                    <td className="px-4 py-3 text-green-600 font-semibold">{formatCurrency(t.total_paid || 0)}</td>
                    <td className="px-4 py-3 text-red-500 font-semibold">{formatCurrency(t.pending_amount || t.rent_amount)}</td>
                    <td className="px-4 py-3"><button onClick={() => { setSelectedTenant(t); setShowPaymentModal(true) }} className="bg-slate-800 text-white px-3 py-1 rounded text-xs mr-2">Collect</button><button onClick={() => deleteTenant(t.id, t.room_id)} className="text-red-500 text-xs">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Complaints Tab */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            {complaints.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex justify-between items-start">
                  <div><div className="flex items-center gap-2 mb-2"><span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">{c.priority || 'Medium'}</span><span className="text-xs text-gray-400">{formatDate(c.created_at)}</span></div><h3 className="font-semibold text-slate-800">{c.title}</h3><p className="text-sm text-gray-500 mt-1">From: {c.tenant_name} • Room {c.room_number}</p><p className="text-gray-600 mt-2">{c.description}</p>{c.admin_response && <p className="text-sm text-green-600 mt-2 bg-green-50 p-2 rounded">Owner: {c.admin_response}</p>}</div>
                  <div className="flex gap-2">{c.status === 'open' && (<button onClick={() => { setSelectedComplaint(c); setShowComplaintResponseModal(true) }} className="bg-slate-800 text-white px-3 py-1 rounded text-sm">Respond</button>)}{c.status === 'in_progress' && (<button onClick={() => resolveComplaint(c.id)} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Mark Resolved</button>)}</div>
                </div>
                <div className="mt-3"><span className={`px-2 py-1 rounded-full text-xs ${c.status === 'open' ? 'bg-red-100 text-red-700' : c.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{c.status === 'open' ? 'Open' : c.status === 'in_progress' ? 'In Progress' : 'Resolved'}</span></div>
              </div>
            ))}
          </div>
        )}

        {/* Vacate Requests Tab */}
        {activeTab === 'vacate' && (
          <div className="space-y-4">
            {vacateRequests.map(req => (
              <div key={req.id} className="bg-white rounded-xl border border-yellow-100 p-4">
                <div className="flex justify-between items-start">
                  <div><div className="flex items-center gap-2 mb-2"><span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">Pending Approval</span><span className="text-xs text-gray-400">Requested: {formatDate(req.requested_date)}</span></div><h3 className="font-semibold text-slate-800">{req.tenant_name}</h3><p className="text-sm text-gray-500">Room {req.room_number}</p><p className="text-sm text-gray-600 mt-1">Expected Check-Out: <strong>{formatDate(req.expected_check_out)}</strong></p>{req.reason && <p className="text-sm text-gray-500 mt-1">Reason: {req.reason}</p>}</div>
                  <button onClick={() => approveVacateRequest(req.id, req.tenant_id, req.room_id)} className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-700 transition">Approve Vacate</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Applications Tab */}
        {activeTab === 'applications' && (
          <div className="space-y-4">
            {applications.map(app => (
              <div key={app.id} className="bg-white rounded-xl border border-gray-100 p-4 flex justify-between items-center">
                <div><h3 className="font-semibold text-slate-800">{app.name}</h3><p className="text-sm text-gray-500">📞 {app.phone}</p>{app.message && <p className="text-sm text-gray-600 mt-1">💬 {app.message}</p>}<p className="text-xs text-gray-400 mt-1">Applied: {formatDate(app.created_at)}</p></div>
                <button onClick={() => approveApplication(app.id)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition">Approve →</button>
              </div>
            ))}
          </div>
        )}

        {/* Notices Tab */}
        {activeTab === 'notices' && (
          <div className="space-y-4">
            <button onClick={() => setShowNoticeModal(true)} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold mb-4">+ Post New Notice</button>
            {notices.map(notice => (
              <div key={notice.id} className={`bg-white rounded-xl border p-4 ${notice.is_urgent ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                <div className="flex items-center gap-2 mb-2"><h3 className="font-semibold text-slate-800">{notice.title}</h3>{notice.is_urgent && <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs">URGENT</span>}<span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">{notice.type}</span></div>
                <p className="text-gray-600">{notice.content}</p>
                <p className="text-xs text-gray-400 mt-2">Posted: {formatDate(notice.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Tenant Modal */}
      <AnimatePresence>{showAddModal && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}><div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}><h2 className="text-2xl font-bold mb-4">Add New Tenant</h2><div className="space-y-4"><input type="text" placeholder="Full Name *" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} /><input type="tel" placeholder="Phone Number *" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} maxLength={10} /><input type="email" placeholder="Email (optional)" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /><input type="number" placeholder="Monthly Rent (₹) *" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.rent_amount} onChange={(e) => setFormData({...formData, rent_amount: e.target.value})} /><select className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.room_id} onChange={(e) => setFormData({...formData, room_id: e.target.value})}><option value="">Select Room</option>{rooms.filter(r => r.current_occupants < r.capacity).map(room => (<option key={room.id} value={room.id}>Room {room.room_number} - {getSharingDetails(room.sharing_type).label} - ₹{formatCurrency(room.monthly_rent)}/month</option>))}</select><div className="flex gap-3 mt-6"><button onClick={addTenant} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold">Add Tenant</button><button onClick={() => setShowAddModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button></div></div></div></div>)}</AnimatePresence>

      {/* Add Room Modal */}
      <AnimatePresence>{showRoomModal && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRoomModal(false)}><div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}><h2 className="text-2xl font-bold mb-4">Add New Room</h2><div className="space-y-4"><input type="text" placeholder="Room Number *" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={roomForm.room_number} onChange={(e) => setRoomForm({...roomForm, room_number: e.target.value})} /><select className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={roomForm.sharing_type} onChange={(e) => { const selected = sharingTypes.find(t => t.value === e.target.value); setRoomForm({...roomForm, sharing_type: e.target.value, monthly_rent: selected.price}) }}>{sharingTypes.map(type => <option key={type.value} value={type.value}>{type.label} {type.icon} - ₹{formatCurrency(type.price)}/month</option>)}</select><input type="number" placeholder="Monthly Rent (₹) *" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={roomForm.monthly_rent} onChange={(e) => setRoomForm({...roomForm, monthly_rent: e.target.value})} /><div className="flex gap-3 mt-6"><button onClick={addRoom} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold">Add Room</button><button onClick={() => setShowRoomModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button></div></div></div></div>)}</AnimatePresence>

      {/* Collect Rent Modal */}
      <AnimatePresence>{showPaymentModal && selectedTenant && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPaymentModal(false)}><div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}><h2 className="text-2xl font-bold mb-4">Collect Rent</h2><div className="bg-gray-50 rounded-xl p-4 mb-4"><p className="font-semibold">{selectedTenant.name}</p><p className="text-sm text-gray-500">Room {selectedTenant.rooms?.room_number}</p><p>Monthly Rent: {formatCurrency(selectedTenant.rent_amount)}</p><p className="text-red-500">Pending: {formatCurrency(selectedTenant.pending_amount || selectedTenant.rent_amount)}</p></div><input type="number" placeholder="Enter Amount (₹)" className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /><div className="flex gap-3"><button onClick={collectRent} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold">Collect</button><button onClick={() => setShowPaymentModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button></div></div></div>)}</AnimatePresence>

      {/* Post Notice Modal - FIXED */}
      <AnimatePresence>{showNoticeModal && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNoticeModal(false)}><div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}><h2 className="text-2xl font-bold mb-4">Post Notice</h2><div className="space-y-4"><input type="text" placeholder="Title *" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={noticeForm.title} onChange={(e) => setNoticeForm({...noticeForm, title: e.target.value})} /><textarea placeholder="Content *" rows="4" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={noticeForm.content} onChange={(e) => setNoticeForm({...noticeForm, content: e.target.value})} /><select className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={noticeForm.type} onChange={(e) => setNoticeForm({...noticeForm, type: e.target.value})}><option value="general">General</option><option value="maintenance">Maintenance</option><option value="payment">Payment</option><option value="event">Event</option><option value="emergency">Emergency</option></select><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={noticeForm.is_urgent} onChange={(e) => setNoticeForm({...noticeForm, is_urgent: e.target.checked})} className="w-4 h-4" /><span className="text-sm">Mark as Urgent</span></label><div className="flex gap-3 mt-6"><button onClick={postNotice} disabled={isSubmitting} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50">{isSubmitting ? 'Posting...' : 'Post Notice'}</button><button onClick={() => setShowNoticeModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button></div></div></div></div>)}</AnimatePresence>

      {/* Respond to Complaint Modal */}
      <AnimatePresence>{showComplaintResponseModal && selectedComplaint && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowComplaintResponseModal(false)}><div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}><h2 className="text-2xl font-bold mb-4">Respond to Complaint</h2><p className="text-sm text-gray-500 mb-2">From: {selectedComplaint.tenant_name}</p><p className="text-sm text-gray-600 mb-4">"{selectedComplaint.title}"</p><textarea placeholder="Your response..." rows="4" className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4" value={complaintResponse} onChange={(e) => setComplaintResponse(e.target.value)} /><div className="flex gap-3"><button onClick={respondToComplaint} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold">Send Response</button><button onClick={() => setShowComplaintResponseModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button></div></div></div>)}</AnimatePresence>

      {/* Room Details Modal */}
      <AnimatePresence>{showRoomDetailsModal && selectedRoom && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRoomDetailsModal(false)}><div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}><div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold text-slate-800">Room {selectedRoom.room_number} Details</h2><button onClick={() => setShowRoomDetailsModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button></div><div className="grid md:grid-cols-2 gap-6"><div><h3 className="font-semibold text-slate-800 mb-3">Room Information</h3><div className="space-y-2 text-sm"><div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Room Number:</span><span className="font-semibold text-slate-700">{selectedRoom.room_number}</span></div><div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Sharing Type:</span><span className="font-semibold text-slate-700">{getSharingDetails(selectedRoom.sharing_type)?.label}</span></div><div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Monthly Rent:</span><span className="font-semibold text-slate-700">{formatCurrency(selectedRoom.monthly_rent)}</span></div><div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Capacity:</span><span className="font-semibold text-slate-700">{selectedRoom.capacity} persons</span></div><div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-500">Current Occupants:</span><span className="font-semibold text-slate-700">{selectedRoom.current_occupants}</span></div></div></div><div><h3 className="font-semibold text-slate-800 mb-3">Current Residents</h3><div className="space-y-3">{getTenantsInRoom(selectedRoom.id).map(tenant => (<div key={tenant.id} className="bg-gray-50 rounded-lg p-3"><div className="flex justify-between items-start"><div><p className="font-semibold text-slate-800">{tenant.name}</p><p className="text-xs text-gray-500">📞 {tenant.phone}</p><p className="text-xs text-gray-500 mt-1">Move-in: {formatDate(tenant.move_in_date)}</p></div><div className="text-right"><p className="text-sm font-semibold text-slate-700">{formatCurrency(tenant.rent_amount)}/month</p><p className={`text-xs ${tenant.rent_status === 'paid' ? 'text-green-500' : 'text-red-500'}`}>{tenant.rent_status === 'paid' ? '✅ Paid' : '⚠️ Pending'}</p></div></div></div>))}{getTenantsInRoom(selectedRoom.id).length === 0 && <p className="text-gray-400 text-center py-4">No residents currently</p>}</div></div></div></div></div>)}</AnimatePresence>
    </div>
  )
}
