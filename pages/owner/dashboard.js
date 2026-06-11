import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
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
  const [complaints, setComplaints] = useState([])
  const [notices, setNotices] = useState([])
  const [propertyImages, setPropertyImages] = useState([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showNoticeModal, setShowNoticeModal] = useState(false)
  const [showRoomDetailsModal, setShowRoomDetailsModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [selectedComplaint, setSelectedComplaint] = useState(null)
  const [showComplaintResponseModal, setShowComplaintResponseModal] = useState(false)
  const [complaintResponse, setComplaintResponse] = useState('')
  const [formData, setFormData] = useState({ 
    name: '', phone: '', email: '', rent_amount: '', room_id: '', advance_amount: '1', joining_fee: '0' 
  })
  const [roomForm, setRoomForm] = useState({ room_number: '', sharing_type: 'double', monthly_rent: 10000 })
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', type: 'general', is_urgent: false })
  const [paymentAmount, setPaymentAmount] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [settings, setSettings] = useState({ joining_fee: 0, advance_months: 1, due_day: 5, upi_id: '' })
  const [stats, setStats] = useState({ 
    totalRooms: 0, occupied: 0, vacant: 0, totalCollected: 0, pendingAmount: 0, 
    totalComplaints: 0, pendingVacate: 0, overdueCount: 0, noticePeriodCount: 0 
  })
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false)
  const [tenantToDelete, setTenantToDelete] = useState(null)
  const [showMembershipModal, setShowMembershipModal] = useState(false)
  const [membershipActive, setMembershipActive] = useState(false)
  const [membershipLoading, setMembershipLoading] = useState(false)
  const autoRefreshInterval = useRef(null)

  const sharingTypes = [
    { value: 'single', label: 'Single Sharing', capacity: 1, icon: '👤', price: 15000 },
    { value: 'double', label: 'Double Sharing', capacity: 2, icon: '👥', price: 10000 },
    { value: 'triple', label: 'Triple Sharing', capacity: 3, icon: '👥👤', price: 8000 },
    { value: 'four', label: 'Four Sharing', capacity: 4, icon: '👥👥', price: 7000 },
    { value: 'five', label: 'Five Sharing', capacity: 5, icon: '👥👥👤', price: 6000 },
  ]

  // Calculate rent due status with badge colours
  const calculateRentDueStatus = (tenant) => {
    if (!tenant) return { status: 'paid', message: '', daysUntilDue: null, dueAmount: 0, badge: 'success' }
    const joinDate = new Date(tenant.move_in_date)
    const today = new Date()
    const monthsSinceJoin = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth())
    const monthsPaid = Math.floor((tenant.total_paid || 0) / tenant.rent_amount)
    const isCurrentMonthPaid = monthsPaid > monthsSinceJoin
    if (isCurrentMonthPaid && (tenant.pending_amount === 0 || tenant.pending_amount < tenant.rent_amount)) {
      const nextDueDate = new Date(today.getFullYear(), today.getMonth() + 1, joinDate.getDate())
      const daysUntilDue = Math.ceil((nextDueDate - today) / (1000 * 60 * 60 * 24))
      return { status: 'paid', message: `Paid ✓ | Next due ${formatDate(nextDueDate)}`, daysUntilDue, dueAmount: 0, badge: 'success' }
    } else {
      const expectedDate = new Date(today.getFullYear(), today.getMonth(), joinDate.getDate())
      const daysUntilDue = Math.ceil((expectedDate - today) / (1000 * 60 * 60 * 24))
      const pendingAmount = tenant.pending_amount || tenant.rent_amount
      if (daysUntilDue < 0) return { status: 'overdue', message: `Overdue ${Math.abs(daysUntilDue)} days`, daysUntilDue, dueAmount: pendingAmount, badge: 'danger' }
      else if (daysUntilDue <= 5) return { status: 'due_soon', message: `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`, daysUntilDue, dueAmount: pendingAmount, badge: 'warning' }
      else return { status: 'pending', message: `Due on ${formatDate(expectedDate)}`, daysUntilDue, dueAmount: pendingAmount, badge: 'info' }
    }
  }

  const getUpcomingVacateForRoom = (roomId) => {
    const vacate = vacateRequests.find(v => v.room_id === roomId && v.status === 'approved')
    if (!vacate) return null
    const vacateDate = new Date(vacate.expected_check_out)
    const daysLeft = Math.ceil((vacateDate - new Date()) / (1000 * 60 * 60 * 24))
    if (daysLeft < 0) return { date: vacate.expected_check_out, daysLeft: 0, overdue: true }
    return { date: vacate.expected_check_out, daysLeft, overdue: false }
  }

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    const userRole = localStorage.getItem('userRole')
    if (!isLoggedIn || userRole !== 'owner') { router.push('/login'); return }
    loadData(); loadSettings(); checkMembershipStatus()
    // Auto-refresh every 30 seconds
    autoRefreshInterval.current = setInterval(() => { 
      loadData(); 
      checkMembershipStatus() 
    }, 30000)
    return () => { if (autoRefreshInterval.current) clearInterval(autoRefreshInterval.current) }
  }, [])

  const loadSettings = async () => {
    try {
      const userId = localStorage.getItem('userId')
      const { data } = await supabase.from('owner_settings').select('*').eq('owner_id', userId).maybeSingle()
      if (data) setSettings({ joining_fee: data.joining_fee || 0, advance_months: data.advance_months || 1, due_day: data.due_day || 5, upi_id: data.upi_id || '' })
      if (property) {
        const { data: propData } = await supabase.from('properties').select('owner_upi_id').eq('id', property.id).single()
        if (propData?.owner_upi_id) setSettings(prev => ({ ...prev, upi_id: propData.owner_upi_id }))
      }
    } catch (error) { console.error(error) }
  }

  const saveSettings = async () => {
    if (!settings.upi_id.trim()) { toast.error('UPI ID is required for rent payments'); return }
    setIsSubmitting(true)
    try {
      const userId = localStorage.getItem('userId')
      await supabase.from('owner_settings').upsert({ owner_id: userId, joining_fee: settings.joining_fee, advance_months: settings.advance_months, due_day: settings.due_day, upi_id: settings.upi_id, updated_at: new Date() })
      if (property) await supabase.from('properties').update({ owner_upi_id: settings.upi_id }).eq('id', property.id)
      toast.success('Settings saved!')
      setShowSettingsModal(false)
    } catch (error) { toast.error('Failed to save settings') }
    finally { setIsSubmitting(false) }
  }

  const checkMembershipStatus = async () => {
    const userId = localStorage.getItem('userId')
    const { data } = await supabase.from('owner_memberships').select('status, end_date').eq('owner_id', userId).maybeSingle()
    setMembershipActive(data && data.status === 'active' && new Date(data.end_date) > new Date())
  }

  const initiateMembershipPayment = async (planId, amount, planName) => {
    setMembershipLoading(true)
    try {
      const response = await fetch('/api/payment/create-membership-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: localStorage.getItem('userId'), planId, amount, ownerName: localStorage.getItem('userName'), ownerEmail: localStorage.getItem('userEmail') })
      })
      const data = await response.json()
      if (data.success) { window.open(data.paymentLink, '_blank'); toast.success('Redirecting...'); setTimeout(() => { checkMembershipStatus(); loadData() }, 10000) }
      else toast.error(data.error || 'Payment initiation failed')
    } catch (error) { toast.error('Failed to initiate payment') }
    finally { setMembershipLoading(false); setShowMembershipModal(false) }
  }

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
        const { data: tenantsData } = await supabase.from('tenants').select('*').eq('property_id', propertyData.id)
        const tenantsWithRoomNumber = (tenantsData || []).map(tenant => {
          const room = roomsData?.find(r => r.id === tenant.room_id)
          return { ...tenant, room_number: room ? room.room_number : 'N/A', dueStatus: calculateRentDueStatus(tenant) }
        })
        setTenants(tenantsWithRoomNumber)
        let totalCollected = 0
        if (tenantsData && tenantsData.length > 0) {
          for (const tenant of tenantsData) {
            const { data: payments } = await supabase.from('payment_history').select('amount').eq('tenant_id', tenant.id).eq('status', 'success')
            if (payments) totalCollected += payments.reduce((sum, p) => sum + p.amount, 0)
          }
        }
        const pendingAmount = tenantsData?.reduce((sum, t) => sum + (t.pending_amount || 0), 0) || 0
        const overdueCount = tenantsWithRoomNumber.filter(t => t.dueStatus.status === 'overdue').length
        const noticePeriodCount = tenantsWithRoomNumber.filter(t => t.status === 'notice_period').length
        setStats({ totalRooms: total, occupied, vacant, totalCollected, pendingAmount, totalComplaints: 0, pendingVacate: 0, overdueCount, noticePeriodCount })
        const { data: appsData } = await supabase.from('applications').select('*').eq('property_id', propertyData.id).eq('status', 'pending')
        setApplications(appsData || [])
        const { data: vacateData } = await supabase.from('check_out_requests').select('*').eq('property_id', propertyData.id).in('status', ['pending', 'approved']).order('created_at', { ascending: false })
        setVacateRequests(vacateData || [])
        setStats(prev => ({ ...prev, pendingVacate: vacateData?.filter(v => v.status === 'pending').length || 0 }))
        const { data: complaintsData } = await supabase.from('complaints').select('*').eq('property_id', propertyData.id).eq('status', 'open').order('created_at', { ascending: false })
        setComplaints(complaintsData || [])
        setStats(prev => ({ ...prev, totalComplaints: complaintsData?.length || 0 }))
        const { data: noticesData } = await supabase.from('notices').select('*').eq('property_id', propertyData.id).order('created_at', { ascending: false })
        setNotices(noticesData || [])
      }
    } catch (error) { toast.error('Failed to load data: ' + error.message) }
    finally { setLoading(false) }
  }

  const getTenantsInRoom = (roomId) => tenants.filter(t => t.room_id === roomId)
  const getRoomNumberById = (roomId) => rooms.find(r => r.id === roomId)?.room_number || 'N/A'

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploadingImage(true)
    let successCount = 0
    for (const file of files) {
      try {
        if (!file.type.startsWith('image/')) { toast.error(`${file.name} is not an image`); continue }
        if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5MB`); continue }
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`
        const filePath = `property-${property.id}/${fileName}`
        const { error: uploadError } = await supabase.storage.from('property-photos').upload(filePath, file, { cacheControl: '3600', upsert: false })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('property-photos').getPublicUrl(filePath)
        const newImages = [...propertyImages, publicUrl]
        await supabase.from('properties').update({ photos: newImages }).eq('id', property.id)
        setPropertyImages(newImages)
        successCount++
      } catch (error) { toast.error(`${file.name}: ${error.message}`) }
    }
    if (successCount > 0) toast.success(`${successCount} photo(s) uploaded!`)
    setUploadingImage(false)
    e.target.value = ''
  }

  const removeImage = async (imageUrl) => {
    setIsSubmitting(true)
    try {
      const newImages = propertyImages.filter(img => img !== imageUrl)
      await supabase.from('properties').update({ photos: newImages }).eq('id', property.id)
      setPropertyImages(newImages)
      toast.success('Photo removed')
    } catch (error) { toast.error('Failed to remove image') }
    finally { setIsSubmitting(false) }
  }

  const addRoom = async () => {
    if (!roomForm.room_number) { toast.error('Enter room number'); return }
    if (rooms.some(r => r.room_number === roomForm.room_number)) { toast.error(`Room ${roomForm.room_number} already exists!`); return }
    setIsSubmitting(true)
    const selectedType = sharingTypes.find(t => t.value === roomForm.sharing_type)
    const { error } = await supabase.from('rooms').insert({ property_id: property.id, room_number: roomForm.room_number, sharing_type: roomForm.sharing_type, monthly_rent: parseInt(roomForm.monthly_rent) || selectedType.price, capacity: selectedType.capacity, current_occupants: 0, status: 'vacant' })
    if (error) toast.error('Failed to add room: ' + error.message)
    else { toast.success(`Room ${roomForm.room_number} added!`); setShowRoomModal(false); setRoomForm({ room_number: '', sharing_type: 'double', monthly_rent: 10000 }); loadData() }
    setIsSubmitting(false)
  }

  const addTenant = async () => {
    if (!formData.name || !formData.phone || !formData.email || !formData.rent_amount || !formData.room_id) { toast.error('All fields required (email is required)'); return }
    const cleanPhone = cleanPhoneNumber(formData.phone)
    if (cleanPhone.length !== 10) { toast.error('Enter valid 10-digit phone number'); return }
    const selectedRoom = rooms.find(r => r.id === formData.room_id)
    if (!selectedRoom) { toast.error('Selected room not found'); return }
    if (selectedRoom.current_occupants >= selectedRoom.capacity) { toast.error(`Room ${selectedRoom.room_number} is full!`); return }
    setIsSubmitting(true)
    try {
      const tenantEmail = formData.email.trim()
      const joiningFee = parseInt(formData.joining_fee) || 0
      const advanceMonths = parseInt(formData.advance_amount) || 0
      const monthlyRent = parseInt(formData.rent_amount)
      const totalJoiningAmount = (monthlyRent * advanceMonths) + joiningFee
      const { data: authData, error: authError } = await supabase.auth.signUp({ email: tenantEmail, password: Math.random().toString(36).slice(-8), options: { data: { full_name: formData.name, role: 'tenant', phone: cleanPhone } } })
      if (authError) throw authError
      const userId = authData.user.id
      await supabase.from('users').insert({ id: userId, email: tenantEmail, full_name: formData.name, phone: cleanPhone, role: 'tenant', is_active: true })
      const pendingAmount = advanceMonths > 0 ? 0 : monthlyRent
      const rentStatus = advanceMonths > 0 ? 'paid' : 'pending'
      await supabase.from('tenants').insert({ user_id: userId, property_id: property.id, room_id: selectedRoom.id, name: formData.name, phone: cleanPhone, email: tenantEmail, rent_amount: monthlyRent, pending_amount: pendingAmount, total_paid: totalJoiningAmount, rent_status: rentStatus, move_in_date: new Date().toISOString().split('T')[0], status: 'active' })
      const newOccupants = selectedRoom.current_occupants + 1
      await supabase.from('rooms').update({ current_occupants: newOccupants, status: newOccupants >= selectedRoom.capacity ? 'occupied' : 'vacant' }).eq('id', selectedRoom.id)
      await supabase.auth.resetPasswordForEmail(tenantEmail, { redirectTo: `${window.location.origin}/reset-password` }).catch(e => console.warn(e))
      toast.success(`Tenant "${formData.name}" added! Login email: ${tenantEmail} | Collected: ₹${totalJoiningAmount.toLocaleString()}`)
      if (advanceMonths > 0) toast.success(`No rent due for ${advanceMonths} month(s)`)
      setShowAddModal(false)
      setFormData({ name: '', phone: '', email: '', rent_amount: '', room_id: '', advance_amount: '1', joining_fee: '0' })
      loadData()
    } catch (error) { toast.error('Failed to add tenant: ' + error.message) }
    finally { setIsSubmitting(false) }
  }

  const deleteTenantComplete = async (tenantId, roomId, userId) => {
    setIsSubmitting(true)
    try {
      await supabase.from('payment_history').delete().eq('tenant_id', tenantId)
      await supabase.from('complaints').delete().eq('tenant_id', tenantId)
      await supabase.from('check_out_requests').delete().eq('tenant_id', tenantId)
      await supabase.from('tenants').delete().eq('id', tenantId)
      const room = rooms.find(r => r.id === roomId)
      if (room) {
        const newOccupants = Math.max(0, room.current_occupants - 1)
        await supabase.from('rooms').update({ current_occupants: newOccupants, status: newOccupants >= room.capacity ? 'occupied' : 'vacant' }).eq('id', roomId)
      }
      if (userId) {
        const { error: userError } = await supabase.from('users').delete().eq('id', userId)
        if (userError) await supabase.from('users').update({ is_active: false, role: 'inactive' }).eq('id', userId)
      }
      toast.success('Tenant and all related data permanently deleted!')
      loadData()
    } catch (error) { toast.error('Failed to delete tenant: ' + error.message) }
    finally { setIsSubmitting(false); setShowConfirmDeleteModal(false); setTenantToDelete(null) }
  }

  const deleteTenantSoft = async (tenantId, roomId) => {
    setIsSubmitting(true)
    try {
      const room = rooms.find(r => r.id === roomId)
      if (room) {
        const newOccupants = Math.max(0, room.current_occupants - 1)
        await supabase.from('rooms').update({ current_occupants: newOccupants, status: newOccupants >= room.capacity ? 'occupied' : 'vacant' }).eq('id', roomId)
      }
      await supabase.from('tenants').delete().eq('id', tenantId)
      toast.success('Tenant removed from room (history preserved)')
      loadData()
    } catch (error) { toast.error('Failed to remove tenant') }
    finally { setIsSubmitting(false); setShowConfirmDeleteModal(false); setTenantToDelete(null) }
  }

  const postNotice = async () => {
    if (!noticeForm.title || !noticeForm.content) { toast.error('Fill title and content'); return }
    setIsSubmitting(true)
    try {
      await supabase.from('notices').insert({ property_id: property.id, title: noticeForm.title, content: noticeForm.content, type: noticeForm.type, is_urgent: noticeForm.is_urgent, created_at: new Date().toISOString() })
      toast.success('Notice posted!')
      setShowNoticeModal(false)
      setNoticeForm({ title: '', content: '', type: 'general', is_urgent: false })
      loadData()
    } catch (error) { toast.error('Failed to post notice: ' + error.message) }
    finally { setIsSubmitting(false) }
  }

  const deleteNotice = async (noticeId) => {
    if (!confirm('Delete this notice?')) return
    setIsSubmitting(true)
    try {
      await supabase.from('notices').delete().eq('id', noticeId)
      toast.success('Notice deleted')
      loadData()
    } catch (error) { toast.error('Failed to delete notice') }
    finally { setIsSubmitting(false) }
  }

  const collectRent = async () => {
    if (!selectedTenant || !paymentAmount) { toast.error('Enter amount'); return }
    const amount = parseInt(paymentAmount)
    const maxAmount = selectedTenant.pending_amount || selectedTenant.rent_amount
    if (amount > maxAmount) { toast.error(`Max payable: ₹${maxAmount.toLocaleString()}`); return }
    setIsSubmitting(true)
    try {
      await supabase.from('payment_history').insert({ tenant_id: selectedTenant.id, amount, payment_date: new Date().toISOString().split('T')[0], payment_method: 'cash', status: 'success' })
      const newTotalPaid = (selectedTenant.total_paid || 0) + amount
      const newPendingAmount = maxAmount - amount
      await supabase.from('tenants').update({ total_paid: newTotalPaid, pending_amount: newPendingAmount, rent_status: newPendingAmount <= 0 ? 'paid' : 'pending', last_payment_date: new Date().toISOString().split('T')[0] }).eq('id', selectedTenant.id)
      toast.success(`₹${amount.toLocaleString()} collected!`)
      setShowPaymentModal(false)
      setPaymentAmount('')
      loadData()
    } catch (error) { toast.error('Failed to collect rent: ' + error.message) }
    finally { setIsSubmitting(false) }
  }

  const respondToComplaint = async () => {
    if (!selectedComplaint) return
    setIsSubmitting(true)
    try {
      await supabase.from('complaints').update({ status: 'in_progress', admin_response: complaintResponse, responded_at: new Date().toISOString() }).eq('id', selectedComplaint.id)
      toast.success('Response sent')
      setShowComplaintResponseModal(false)
      setComplaintResponse('')
      loadData()
    } catch (error) { toast.error('Failed to send response') }
    finally { setIsSubmitting(false) }
  }

  const resolveComplaint = async (complaintId) => {
    if (!confirm('Mark as resolved?')) return
    setIsSubmitting(true)
    try {
      await supabase.from('complaints').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', complaintId)
      toast.success('Complaint resolved')
      loadData()
    } catch (error) { toast.error('Failed to resolve') }
    finally { setIsSubmitting(false) }
  }

  const approveVacateRequest = async (requestId, tenantId, roomId) => {
    if (!confirm('Approve vacate request?')) return
    setIsSubmitting(true)
    try {
      await supabase.from('check_out_requests').update({ status: 'approved', processed_at: new Date(), owner_notes: 'Vacation approved.' }).eq('id', requestId)
      await supabase.from('tenants').update({ status: 'notice_period', check_out_requested: true, notice_period_start: new Date().toISOString().split('T')[0], notice_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }).eq('id', tenantId)
      toast.success('Vacate request approved – tenant is on notice period')
      loadData()
    } catch (error) { toast.error('Failed to approve') }
    finally { setIsSubmitting(false) }
  }

  const approveApplication = async (appId) => {
    setIsSubmitting(true)
    try {
      const { data: app } = await supabase.from('applications').select('*').eq('id', appId).single()
      const { data: room } = await supabase.from('rooms').select('*').eq('id', app.room_id).single()
      let userId = null
      const { data: existingUser } = await supabase.from('users').select('id').eq('phone', app.phone).maybeSingle()
      if (existingUser) userId = existingUser.id
      else {
        const { data: newUser } = await supabase.from('users').insert({ phone: app.phone, email: app.email, full_name: app.name, role: 'tenant', is_active: true }).select().single()
        userId = newUser.id
      }
      await supabase.from('tenants').insert({ user_id: userId, property_id: app.property_id, room_id: app.room_id, name: app.name, phone: app.phone, email: app.email, rent_amount: room.monthly_rent, pending_amount: room.monthly_rent, total_paid: 0, rent_status: 'pending', move_in_date: app.expected_move_in || new Date().toISOString().split('T')[0], status: 'active' })
      const newOccupants = (room.current_occupants || 0) + 1
      await supabase.from('rooms').update({ current_occupants: newOccupants, status: newOccupants >= room.capacity ? 'occupied' : 'vacant' }).eq('id', app.room_id)
      await supabase.from('applications').update({ status: 'approved', processed_at: new Date() }).eq('id', appId)
      toast.success('Application approved!')
      loadData()
    } catch (error) { toast.error('Failed to approve') }
    finally { setIsSubmitting(false) }
  }

  const deleteRoom = async (id) => {
    const room = rooms.find(r => r.id === id)
    if (room.current_occupants > 0) { toast.error(`Cannot delete room with ${room.current_occupants} occupants`); return }
    if (!confirm(`Delete Room ${room.room_number}?`)) return
    setIsSubmitting(true)
    try {
      await supabase.from('rooms').delete().eq('id', id)
      toast.success('Room deleted')
      loadData()
    } catch (error) { toast.error('Failed to delete room') }
    finally { setIsSubmitting(false) }
  }

  const handleLogout = () => { localStorage.clear(); router.push('/') }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800"></div></div>
  if (!property) return <div className="min-h-screen bg-white flex flex-col items-center justify-center"><h1 className="text-2xl font-bold mb-4">Welcome to HOSTELSET!</h1><Link href="/owner/register-property" className="bg-slate-800 text-white px-6 py-3 rounded-full">Register Your First Property →</Link></div>

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 px-6 py-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3"><h1 className="text-2xl font-bold text-slate-800">🏠 HOSTELSET</h1><span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Owner</span></div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowMembershipModal(true)} className={`px-3 py-1 rounded-lg text-sm font-semibold transition ${membershipActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{membershipActive ? '✅ Active' : '⭐ Buy Membership'}</button>
            <button onClick={() => setShowSettingsModal(true)} className="text-gray-500 hover:text-slate-800 transition px-3 py-1 rounded-lg hover:bg-gray-100">⚙️ Settings</button>
            <span className="text-sm hidden md:inline text-gray-500">{property.name}</span>
            <button onClick={handleLogout} className="text-red-500 hover:text-red-600 transition">Logout</button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm border text-center"><div className="text-2xl font-bold">{stats.totalRooms}</div><div className="text-xs text-gray-500">Total Rooms</div></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border text-center"><div className="text-2xl font-bold text-green-600">{stats.occupied}</div><div className="text-xs text-gray-500">Occupied</div></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border text-center"><div className="text-2xl font-bold text-orange-500">{stats.vacant}</div><div className="text-xs text-gray-500">Available</div></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border text-center"><div className="text-2xl font-bold text-blue-600">₹{stats.totalCollected.toLocaleString()}</div><div className="text-xs text-gray-500">Collected</div></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border text-center"><div className="text-2xl font-bold text-red-600">{stats.overdueCount}</div><div className="text-xs text-gray-500">Overdue</div></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border text-center"><div className="text-2xl font-bold text-purple-600">{stats.noticePeriodCount}</div><div className="text-xs text-gray-500">Notice Period</div></div>
          <div className="bg-white rounded-xl p-4 shadow-sm border text-center"><div className="text-2xl font-bold text-yellow-600">{stats.pendingVacate}</div><div className="text-xs text-gray-500">Vacate Requests</div></div>
        </div>

        {/* Property Photos */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">📸 Property Photos</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {propertyImages?.map((img, i) => (
              <div key={i} className="relative group"><img src={img} className="w-full h-24 object-cover rounded-lg" onError={e => e.target.src='https://via.placeholder.com/150?text=Error'} /><button onClick={() => removeImage(img)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 text-sm opacity-0 group-hover:opacity-100">✕</button></div>
            ))}
            <label className={`border-2 border-dashed rounded-lg h-24 flex flex-col items-center justify-center cursor-pointer ${uploadingImage ? 'opacity-50' : ''}`}>
              <div className="text-center"><div className="text-2xl">{uploadingImage ? '⏳' : '📷'}</div><div className="text-xs">{uploadingImage ? 'Uploading...' : 'Add Photo'}</div></div>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button onClick={() => setShowAddModal(true)} className="bg-slate-800 text-white px-5 py-2 rounded-full text-sm font-semibold">+ Add Tenant</button>
          <button onClick={() => setShowRoomModal(true)} className="border-2 border-slate-300 text-slate-700 px-5 py-2 rounded-full">+ Add Room</button>
          <button onClick={() => setShowNoticeModal(true)} className="border-2 border-slate-300 text-slate-700 px-5 py-2 rounded-full">📢 Post Notice</button>
          <button onClick={() => setShowSettingsModal(true)} className="border-2 border-blue-300 text-blue-700 px-5 py-2 rounded-full">⚙️ Settings</button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-gray-200 mb-6 gap-2">
          {['overview', 'rooms', 'tenants', 'complaints', 'vacate', 'applications', 'notices'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2 text-sm font-semibold capitalize rounded-t-lg ${activeTab === tab ? 'bg-slate-800 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {tab === 'overview' && '📊 Overview'} {tab === 'rooms' && `🏠 Rooms (${rooms.length})`} {tab === 'tenants' && `👥 Tenants (${tenants.length})`}
              {tab === 'complaints' && `🔧 Complaints ${stats.totalComplaints}`} {tab === 'vacate' && `🚪 Vacate (${stats.pendingVacate})`}
              {tab === 'applications' && `📋 Applications (${applications.length})`} {tab === 'notices' && `📢 Notices (${notices.length})`}
            </button>
          ))}
        </div>

        {/* Overview Tab – Enhanced with Tags */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-4">📋 Recent Tenants</h3>
              <div className="space-y-3">
                {tenants.slice(0, 5).map(t => {
                  const dueStatus = t.dueStatus
                  const vacateReq = vacateRequests.find(v => v.tenant_id === t.id && v.status === 'approved')
                  let vacateDays = null
                  if (vacateReq) vacateDays = Math.ceil((new Date(vacateReq.expected_check_out) - new Date()) / (1000*60*60*24))
                  return (
                    <div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div><p className="font-medium">{t.name}</p><p className="text-xs text-gray-400">Room {t.room_number}</p></div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(t.rent_amount)}</p>
                        <div className="flex gap-1 mt-1 flex-wrap justify-end">
                          {t.status === 'notice_period' && <span className="text-xs bg-purple-100 text-purple-700 px-1 rounded">Notice Period</span>}
                          {dueStatus.badge === 'danger' && <span className="text-xs bg-red-100 text-red-700 px-1 rounded">⚠️ Overdue</span>}
                          {dueStatus.badge === 'warning' && <span className="text-xs bg-orange-100 text-orange-700 px-1 rounded">⏰ Due soon</span>}
                          {vacateDays !== null && vacateDays > 0 && <span className="text-xs bg-yellow-100 text-yellow-700 px-1 rounded">🚪 Vacates in {vacateDays}d</span>}
                          {vacateDays !== null && vacateDays <= 0 && <span className="text-xs bg-red-200 text-red-800 px-1 rounded">⚠️ Vacate overdue</span>}
                          {t.status === 'active' && dueStatus.badge === 'success' && <span className="text-xs bg-green-100 text-green-700 px-1 rounded">Active ✅</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {!tenants.length && <p className="text-gray-400 text-center py-4">No tenants yet</p>}
              </div>
            </div>
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-4">🔧 Recent Complaints</h3>
              <div className="space-y-3">
                {complaints.slice(0, 5).map(c => (
                  <div key={c.id} className="p-3 bg-orange-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div><p className="font-medium text-orange-700">{c.title}</p><div className="flex gap-1 mt-1">{c.priority === 'high' && <span className="text-xs bg-red-100 text-red-700 px-1 rounded">High</span>}{c.priority === 'medium' && <span className="text-xs bg-yellow-100 text-yellow-700 px-1 rounded">Medium</span>}{c.priority === 'low' && <span className="text-xs bg-green-100 text-green-700 px-1 rounded">Low</span>}</div><p className="text-xs text-gray-500 mt-1">From: {c.tenant_name}</p></div>
                      <button onClick={() => { setSelectedComplaint(c); setShowComplaintResponseModal(true) }} className="text-xs bg-orange-600 text-white px-2 py-1 rounded">Respond</button>
                    </div>
                  </div>
                ))}
                {!complaints.length && <p className="text-gray-400 text-center py-4">No complaints yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* Rooms Tab – already has vacate badge */}
        {activeTab === 'rooms' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map(room => {
              const sharing = getSharingDetails(room.sharing_type)
              const isFull = room.current_occupants >= room.capacity
              const availableSlots = room.capacity - room.current_occupants
              const roomTenants = getTenantsInRoom(room.id)
              const upcomingVacate = getUpcomingVacateForRoom(room.id)
              return (
                <div key={room.id} onClick={() => { setSelectedRoom(room); setShowRoomDetailsModal(true) }} className={`bg-white rounded-2xl shadow-lg cursor-pointer border overflow-hidden relative ${isFull ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-gradient-to-br from-slate-50 to-gray-50'}`}>
                  {upcomingVacate && <div className={`absolute top-2 right-2 z-10 px-2 py-1 rounded-full text-xs font-bold ${upcomingVacate.daysLeft <= 3 ? 'bg-red-500 text-white animate-pulse' : 'bg-orange-500 text-white'}`}>🚪 Vacates {upcomingVacate.daysLeft > 0 ? `in ${upcomingVacate.daysLeft} days` : 'overdue'}</div>}
                  <div className="p-5">
                    <div className="flex justify-between items-start"><div><h3 className="text-2xl font-bold">Room {room.room_number}</h3><p className="text-sm text-gray-500">{sharing.label} {sharing.icon}</p></div><div className={`px-3 py-1 rounded-full text-xs ${isFull ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>{isFull ? 'Full' : `${availableSlots} slot`}</div></div>
                    <div className="mt-4"><p className="text-2xl font-bold">{formatCurrency(room.monthly_rent)}<span className="text-sm text-gray-400">/month</span></p></div>
                    <div className="mt-4"><div className="flex justify-between text-sm mb-1"><span>Occupancy</span><span>{room.current_occupants}/{room.capacity}</span></div><div className="w-full bg-gray-200 rounded-full h-2"><div className="h-2 rounded-full bg-slate-600" style={{ width: `${(room.current_occupants / room.capacity) * 100}%` }}></div></div></div>
                    {roomTenants.length > 0 && (<div className="mt-4 pt-3 border-t"><p className="text-xs text-gray-500 mb-2">Residents:</p><div className="flex -space-x-2">{roomTenants.slice(0,3).map(t => (<div key={t.id} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold border-2 border-white">{t.name.charAt(0)}</div>))}{roomTenants.length > 3 && <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold border-2 border-white">+{roomTenants.length-3}</div>}</div></div>)}
                    <div className="mt-3 pt-2 flex justify-end"><button onClick={(e) => { e.stopPropagation(); deleteRoom(room.id) }} className="text-red-400 hover:text-red-600 text-xs">Delete Room</button></div>
                  </div>
                </div>
              )
            })}
            {!rooms.length && <div className="col-span-full text-center py-12"><p className="text-gray-500">No rooms added yet</p><button onClick={() => setShowRoomModal(true)} className="mt-2 text-slate-600 underline">Add your first room</button></div>}
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === 'tenants' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b"><tr><th className="px-4 py-3 text-left text-sm">Name</th><th className="px-4 py-3 text-left">Phone</th><th className="px-4 py-3 text-left">Room</th><th className="px-4 py-3 text-left">Rent</th><th className="px-4 py-3 text-left">Paid</th><th className="px-4 py-3 text-left">Pending</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Actions</th></tr></thead>
              <tbody>
                {tenants.map(t => {
                  const dueStatus = t.dueStatus
                  return (
                    <tr key={t.id} className={`border-b ${dueStatus.status === 'overdue' ? 'bg-red-50' : dueStatus.status === 'due_soon' ? 'bg-orange-50' : ''}`}>
                      <td className="px-4 py-3 font-medium">{t.name} {t.status === 'notice_period' && <span className="ml-1 text-xs bg-purple-200 px-1 rounded">Notice</span>}</td>
                      <td className="px-4 py-3">{t.phone}</td><td className="px-4 py-3">Room {t.room_number}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(t.rent_amount)}</td><td className="px-4 py-3 text-green-600">{formatCurrency(t.total_paid)}</td>
                      <td className="px-4 py-3 text-red-500">{formatCurrency(t.pending_amount)}</td>
                      <td className="px-4 py-3">{dueStatus.badge === 'danger' && <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">⚠️ Overdue</span>}{dueStatus.badge === 'warning' && <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">📢 Due soon</span>}{dueStatus.badge === 'info' && <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">💰 Pending</span>}{dueStatus.badge === 'success' && <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">✅ Paid</span>}</td>
                      <td className="px-4 py-3"><button onClick={() => { setSelectedTenant(t); setShowPaymentModal(true) }} className="bg-slate-800 text-white px-3 py-1 rounded text-xs mr-2">Collect</button><button onClick={() => { setTenantToDelete(t); setShowConfirmDeleteModal(true) }} className="bg-red-500 text-white px-3 py-1 rounded text-xs">Delete</button></td>
                    </tr>
                  )
                })}
                {!tenants.length && <tr><td colSpan="8" className="text-center py-8">No tenants added yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Complaints Tab */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            {complaints.map(c => (
              <div key={c.id} className="bg-white rounded-xl border p-4">
                <div className="flex justify-between items-start">
                  <div><div className="flex items-center gap-2 mb-2"><span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">{c.priority}</span><span className="text-xs text-gray-400">{formatDate(c.created_at)}</span></div><h3 className="font-semibold">{c.title}</h3><p className="text-sm text-gray-500">From: {c.tenant_name}</p><p className="text-gray-600 mt-2">{c.description}</p>{c.admin_response && <p className="text-sm text-green-600 mt-2 bg-green-50 p-2 rounded">Response: {c.admin_response}</p>}</div>
                  <div>{c.status === 'open' && <button onClick={() => { setSelectedComplaint(c); setShowComplaintResponseModal(true) }} className="bg-slate-800 text-white px-3 py-1 rounded text-sm">Respond</button>}{c.status === 'in_progress' && <button onClick={() => resolveComplaint(c.id)} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Resolve</button>}</div>
                </div>
                <div className="mt-3"><span className={`px-2 py-1 rounded-full text-xs ${c.status === 'open' ? 'bg-red-100 text-red-700' : c.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{c.status === 'open' ? 'Open' : c.status === 'in_progress' ? 'In Progress' : 'Resolved'}</span></div>
              </div>
            ))}
            {!complaints.length && <div className="text-center py-12">No complaints to review</div>}
          </div>
        )}

        {/* Vacate Tab */}
        {activeTab === 'vacate' && (
          <div className="space-y-4">
            {vacateRequests.map(req => {
              const daysLeft = Math.ceil((new Date(req.expected_check_out) - new Date()) / (1000*60*60*24))
              return (
                <div key={req.id} className={`bg-white rounded-xl border p-4 ${daysLeft <= 7 ? 'border-red-200 bg-red-50' : 'border-yellow-100'}`}>
                  <div className="flex justify-between items-start">
                    <div><div className="flex items-center gap-2 mb-2"><span className={`px-2 py-1 rounded-full text-xs ${daysLeft <= 7 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{daysLeft <= 7 ? `⚠️ ${daysLeft} days left` : 'Pending'}</span><span className="text-xs">{formatDate(req.requested_date)}</span></div><h3 className="font-semibold">{req.tenant_name}</h3><p className="text-sm text-gray-500">Room {req.room_number}</p><p className="text-sm">Expected: {formatDate(req.expected_check_out)}</p>{req.reason && <p className="text-sm text-gray-500">Reason: {req.reason}</p>}</div>
                    <button onClick={() => approveVacateRequest(req.id, req.tenant_id, req.room_id)} className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm">Approve</button>
                  </div>
                </div>
              )
            })}
            {!vacateRequests.length && <div className="text-center py-12">No vacate requests</div>}
          </div>
        )}

        {/* Applications Tab */}
        {activeTab === 'applications' && (
          <div className="space-y-4">
            {applications.map(app => (
              <div key={app.id} className="bg-white rounded-xl border p-4 flex justify-between items-center">
                <div><h3 className="font-semibold">{app.name}</h3><p className="text-sm text-gray-500">📞 {app.phone}</p>{app.message && <p className="text-sm">💬 {app.message}</p>}<p className="text-xs text-gray-400">Applied: {formatDate(app.created_at)}</p></div>
                <button onClick={() => approveApplication(app.id)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm">Approve →</button>
              </div>
            ))}
            {!applications.length && <div className="text-center py-12">No pending applications</div>}
          </div>
        )}

        {/* Notices Tab */}
        {activeTab === 'notices' && (
          <div className="space-y-4">
            <button onClick={() => setShowNoticeModal(true)} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm mb-4">+ Post New Notice</button>
            {notices.map(notice => (
              <div key={notice.id} className={`bg-white rounded-xl border p-4 ${notice.is_urgent ? 'border-red-200 bg-red-50' : 'border-gray-100'} relative group`}>
                <button onClick={() => deleteNotice(notice.id)} className="absolute top-4 right-4 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">🗑️ Delete</button>
                <div className="flex items-center gap-2 mb-2 pr-12"><h3 className="font-semibold">{notice.title}</h3>{notice.is_urgent && <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs">URGENT</span>}<span className="px-2 py-1 bg-gray-100 rounded-full text-xs">{notice.type}</span></div>
                <p className="text-gray-600">{notice.content}</p>
                <p className="text-xs text-gray-400 mt-2">Posted: {formatDate(notice.created_at)}</p>
              </div>
            ))}
            {!notices.length && <div className="text-center py-12">No notices posted yet</div>}
          </div>
        )}
      </div>

      {/* All Modals (unchanged from your working version) */}
      <AnimatePresence>
        {showConfirmDeleteModal && tenantToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowConfirmDeleteModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold text-red-600 mb-4">⚠️ Delete Tenant</h2>
              <p className="mb-4">Delete <strong>{tenantToDelete.name}</strong>?</p>
              <div className="bg-yellow-50 p-3 rounded-lg mb-4"><p className="text-sm text-yellow-800">Deletes: tenant record, payments, complaints, vacate requests, user account.</p></div>
              <div className="flex gap-3"><button onClick={() => deleteTenantComplete(tenantToDelete.id, tenantToDelete.room_id, tenantToDelete.user_id)} className="flex-1 bg-red-600 text-white py-3 rounded-xl">Delete Permanently</button><button onClick={() => deleteTenantSoft(tenantToDelete.id, tenantToDelete.room_id)} className="flex-1 bg-yellow-600 text-white py-3 rounded-xl">Remove from Room Only</button><button onClick={() => setShowConfirmDeleteModal(false)} className="flex-1 border-2 border-gray-300 py-3 rounded-xl">Cancel</button></div>
            </div>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Add New Tenant</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Full Name *" className="w-full px-4 py-3 border rounded-xl" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                <input type="tel" placeholder="Phone Number *" className="w-full px-4 py-3 border rounded-xl" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} maxLength={10} />
                <input type="email" placeholder="Email Address * (required for login)" className="w-full px-4 py-3 border rounded-xl" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                <input type="number" placeholder="Monthly Rent (₹) *" className="w-full px-4 py-3 border rounded-xl" value={formData.rent_amount} onChange={(e) => setFormData({...formData, rent_amount: e.target.value})} />
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-gray-500">Advance Months</label><input type="number" placeholder="Advance Months" className="w-full px-4 py-3 border rounded-xl" value={formData.advance_amount} onChange={(e) => setFormData({...formData, advance_amount: e.target.value})} min="0" /></div>
                  <div><label className="block text-xs text-gray-500">Joining Fee (₹)</label><input type="number" placeholder="Joining Fee" className="w-full px-4 py-3 border rounded-xl" value={formData.joining_fee} onChange={(e) => setFormData({...formData, joining_fee: e.target.value})} min="0" /></div>
                </div>
                <select className="w-full px-4 py-3 border rounded-xl" value={formData.room_id} onChange={(e) => setFormData({...formData, room_id: e.target.value})}>
                  <option value="">Select Room</option>
                  {rooms.filter(r => r.current_occupants < r.capacity).map(room => <option key={room.id} value={room.id}>Room {room.room_number} - {getSharingDetails(room.sharing_type)?.label} - ₹{formatCurrency(room.monthly_rent)}/month ({room.capacity - room.current_occupants} slots left)</option>)}
                </select>
                <div className="bg-blue-50 p-3 rounded-lg"><p className="text-xs text-blue-700">📌 Tenant will receive password set email. They can login with email.</p></div>
                <div className="flex gap-3 mt-6"><button onClick={addTenant} className="flex-1 bg-slate-800 text-white py-3 rounded-xl">Add Tenant</button><button onClick={() => setShowAddModal(false)} className="flex-1 border-2 border-gray-300 py-3 rounded-xl">Cancel</button></div>
              </div>
            </div>
          </div>
        )}

        {showRoomModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRoomModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Add New Room</h2>
              <div className="space-y-4"><input type="text" placeholder="Room Number *" className="w-full px-4 py-3 border rounded-xl" value={roomForm.room_number} onChange={(e) => setRoomForm({...roomForm, room_number: e.target.value})} /><select className="w-full px-4 py-3 border rounded-xl" value={roomForm.sharing_type} onChange={(e) => { const selected = sharingTypes.find(t => t.value === e.target.value); setRoomForm({...roomForm, sharing_type: e.target.value, monthly_rent: selected.price}) }}>{sharingTypes.map(type => <option key={type.value} value={type.value}>{type.label} {type.icon} - ₹{formatCurrency(type.price)}/month</option>)}</select><input type="number" placeholder="Monthly Rent (₹) *" className="w-full px-4 py-3 border rounded-xl" value={roomForm.monthly_rent} onChange={(e) => setRoomForm({...roomForm, monthly_rent: e.target.value})} /><div className="flex gap-3 mt-6"><button onClick={addRoom} className="flex-1 bg-slate-800 text-white py-3 rounded-xl">Add Room</button><button onClick={() => setShowRoomModal(false)} className="flex-1 border-2 border-gray-300 py-3 rounded-xl">Cancel</button></div></div>
            </div>
          </div>
        )}

        {showPaymentModal && selectedTenant && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPaymentModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Collect Rent</h2>
              <div className="bg-gray-50 p-4 rounded-xl mb-4"><p className="font-semibold">{selectedTenant.name}</p><p className="text-sm text-gray-500">Room {selectedTenant.room_number}</p><p>Monthly Rent: {formatCurrency(selectedTenant.rent_amount)}</p><p className="text-red-500">Pending: {formatCurrency(selectedTenant.pending_amount)}</p></div>
              <input type="number" placeholder="Amount (₹)" className="w-full px-4 py-3 border rounded-xl mb-4" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
              <div className="flex gap-3"><button onClick={collectRent} className="flex-1 bg-green-600 text-white py-3 rounded-xl">Collect</button><button onClick={() => setShowPaymentModal(false)} className="flex-1 border-2 border-gray-300 py-3 rounded-xl">Cancel</button></div>
            </div>
          </div>
        )}

        {showNoticeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNoticeModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Post Notice</h2>
              <div className="space-y-4"><input type="text" placeholder="Title *" className="w-full px-4 py-3 border rounded-xl" value={noticeForm.title} onChange={(e) => setNoticeForm({...noticeForm, title: e.target.value})} /><textarea placeholder="Content *" rows="4" className="w-full px-4 py-3 border rounded-xl" value={noticeForm.content} onChange={(e) => setNoticeForm({...noticeForm, content: e.target.value})} /><select className="w-full px-4 py-3 border rounded-xl" value={noticeForm.type} onChange={(e) => setNoticeForm({...noticeForm, type: e.target.value})}><option>General</option><option>Maintenance</option><option>Payment</option><option>Event</option><option>Emergency</option></select><label className="flex items-center gap-2"><input type="checkbox" checked={noticeForm.is_urgent} onChange={(e) => setNoticeForm({...noticeForm, is_urgent: e.target.checked})} /><span>Urgent</span></label><div className="flex gap-3 mt-6"><button onClick={postNotice} className="flex-1 bg-slate-800 text-white py-3 rounded-xl">Post Notice</button><button onClick={() => setShowNoticeModal(false)} className="flex-1 border-2 border-gray-300 py-3 rounded-xl">Cancel</button></div></div>
            </div>
          </div>
        )}

        {showSettingsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSettingsModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">⚙️ Property Settings</h2>
              <div className="space-y-4"><div><label className="block text-sm font-semibold">Joining Fee (₹)</label><input type="number" className="w-full px-4 py-3 border rounded-xl" value={settings.joining_fee} onChange={(e) => setSettings({...settings, joining_fee: parseInt(e.target.value) || 0})} min="0" /></div><div><label className="block text-sm font-semibold">Advance Months Required</label><input type="number" className="w-full px-4 py-3 border rounded-xl" value={settings.advance_months} onChange={(e) => setSettings({...settings, advance_months: parseInt(e.target.value) || 0})} min="0" max="12" /></div><div><label className="block text-sm font-semibold">Alert Threshold (days before due)</label><input type="number" className="w-full px-4 py-3 border rounded-xl" value={settings.due_day} onChange={(e) => setSettings({...settings, due_day: parseInt(e.target.value) || 5})} min="1" max="30" /></div><div><label className="block text-sm font-semibold">Your UPI ID (for rent payments)</label><input type="text" className="w-full px-4 py-3 border rounded-xl" placeholder="yourname@okhdfcbank" value={settings.upi_id} onChange={(e) => setSettings({...settings, upi_id: e.target.value})} /><p className="text-xs text-gray-400 mt-1">Tenants pay rent directly to this UPI ID (zero fee).</p></div><div className="flex gap-3 mt-6"><button onClick={saveSettings} className="flex-1 bg-slate-800 text-white py-3 rounded-xl">Save Settings</button><button onClick={() => setShowSettingsModal(false)} className="flex-1 border-2 border-gray-300 py-3 rounded-xl">Cancel</button></div></div>
            </div>
          </div>
        )}

        {showComplaintResponseModal && selectedComplaint && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowComplaintResponseModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Respond to Complaint</h2>
              <p className="text-sm text-gray-500 mb-2">From: {selectedComplaint.tenant_name}</p><p className="text-sm text-gray-600 mb-4">"{selectedComplaint.title}"</p>
              <textarea placeholder="Your response..." rows="4" className="w-full px-4 py-3 border rounded-xl mb-4" value={complaintResponse} onChange={(e) => setComplaintResponse(e.target.value)} />
              <div className="flex gap-3"><button onClick={respondToComplaint} className="flex-1 bg-slate-800 text-white py-3 rounded-xl">Send Response</button><button onClick={() => setShowComplaintResponseModal(false)} className="flex-1 border-2 border-gray-300 py-3 rounded-xl">Cancel</button></div>
            </div>
          </div>
        )}

        {showRoomDetailsModal && selectedRoom && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRoomDetailsModal(false)}>
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold">Room {selectedRoom.room_number} Details</h2><button onClick={() => setShowRoomDetailsModal(false)} className="text-gray-400 text-2xl">✕</button></div>
              <div className="grid md:grid-cols-2 gap-6"><div><h3 className="font-semibold mb-3">Room Information</h3><div className="space-y-2 text-sm"><div className="flex justify-between py-2 border-b"><span>Room Number:</span><span>{selectedRoom.room_number}</span></div><div className="flex justify-between py-2 border-b"><span>Sharing Type:</span><span>{getSharingDetails(selectedRoom.sharing_type)?.label}</span></div><div className="flex justify-between py-2 border-b"><span>Monthly Rent:</span><span>{formatCurrency(selectedRoom.monthly_rent)}</span></div><div className="flex justify-between py-2 border-b"><span>Capacity:</span><span>{selectedRoom.capacity}</span></div><div className="flex justify-between py-2 border-b"><span>Current Occupants:</span><span>{selectedRoom.current_occupants}</span></div></div></div><div><h3 className="font-semibold mb-3">Current Residents</h3><div className="space-y-3">{getTenantsInRoom(selectedRoom.id).map(tenant => (<div key={tenant.id} className="bg-gray-50 rounded-lg p-3"><div className="flex justify-between items-start"><div><p className="font-semibold">{tenant.name}</p><p className="text-xs text-gray-500">📞 {tenant.phone}</p><p className="text-xs">Move-in: {formatDate(tenant.move_in_date)}</p></div><div className="text-right"><p className="text-sm font-semibold">{formatCurrency(tenant.rent_amount)}/month</p><p className={`text-xs ${tenant.rent_status === 'paid' ? 'text-green-500' : 'text-red-500'}`}>{tenant.rent_status === 'paid' ? '✅ Paid' : '⚠️ Pending'}</p></div></div></div>))}{getTenantsInRoom(selectedRoom.id).length === 0 && <p className="text-gray-400 text-center py-4">No residents</p>}</div></div></div>
            </div>
          </div>
        )}

        {showMembershipModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowMembershipModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">✨ Choose Membership Plan</h2>
              <div className="space-y-3">
                <button onClick={() => initiateMembershipPayment('monthly', 499, 'Monthly')} disabled={membershipLoading} className="w-full p-4 border rounded-xl text-left hover:bg-gray-50 transition"><div className="font-bold">Monthly Plan</div><div className="text-sm">₹499 / month</div><div className="text-xs text-gray-400 mt-1">✓ Basic support • Up to 50 tenants</div></button>
                <button onClick={() => initiateMembershipPayment('yearly', 4999, 'Yearly')} disabled={membershipLoading} className="w-full p-4 border rounded-xl text-left hover:bg-gray-50 transition"><div className="font-bold">Yearly Plan</div><div className="text-sm">₹4,999 / year</div><div className="text-xs text-gray-400 mt-1">✓ Priority support • Unlimited tenants • Analytics</div></button>
              </div>
              <button onClick={() => setShowMembershipModal(false)} className="w-full mt-4 py-2 text-gray-500">Cancel</button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
