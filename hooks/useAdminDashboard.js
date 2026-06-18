import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate } from '../lib/utils'
import toast from 'react-hot-toast'

export function useAdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  // Data states
  const [properties, setProperties] = useState([])
  const [tenants, setTenants] = useState([])
  const [payments, setPayments] = useState([])
  const [complaints, setComplaints] = useState([])
  const [vacateRequests, setVacateRequests] = useState([])
  const [applications, setApplications] = useState([])
  const [approvedApplications, setApprovedApplications] = useState([])
  const [rooms, setRooms] = useState([])
  const [preBookings, setPreBookings] = useState([])
  const [notices, setNotices] = useState([])
  const [users, setUsers] = useState([])
  const [ownerSettings, setOwnerSettings] = useState([])
  const [membershipPlans, setMembershipPlans] = useState([])
  const [systemSettings, setSystemSettings] = useState({
    pre_booking_fee: 999,
    max_advance_months: 6,
    due_alert_days: 5,
  })
  const [auditLogs, setAuditLogs] = useState([])
  const [roomChangeRequests, setRoomChangeRequests] = useState([])
  const [stats, setStats] = useState({
    totalProperties: 0, totalTenants: 0, totalRevenue: 0, occupancyRate: 0,
    pendingApplications: 0, pendingPayments: 0, unresolvedComplaints: 0,
    pendingMemberships: 0, pendingRoomChanges: 0,
  })
  const [revenueData, setRevenueData] = useState([])
  const [occupancyData, setOccupancyData] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [grantModal, setGrantModal] = useState({ show: false, ownerId: null, ownerName: '' })
  const [grantDuration, setGrantDuration] = useState(30)
  const [grantSubmitting, setGrantSubmitting] = useState(false)
  const [selectedProperties, setSelectedProperties] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [editPlanModal, setEditPlanModal] = useState({ show: false, plan: null })
  const [editSettingsModal, setEditSettingsModal] = useState(false)
  const [editOwnerSettingsModal, setEditOwnerSettingsModal] = useState({ show: false, settings: null })
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ show: false, type: '', id: null, name: '' })
  const [rejectReasonModal, setRejectReasonModal] = useState({ show: false, requestId: null, type: '' })
  const [rejectionReason, setRejectionReason] = useState('')
  const autoRefreshRef = useRef(null)

  // ---------- Load all data ----------
  const loadAllData = async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    try {
      const [
        { data: props },
        { data: tnts },
        { data: pms },
        { data: cmps },
        { data: vacates },
        { data: apps },
        { data: approvedApps },
        { data: rms },
        { data: prebooks },
        { data: notes },
        { data: usrs },
        { data: ownerSet },
        { data: plans },
        { data: sysSet },
        { data: logs },
        { data: roomChanges }
      ] = await Promise.all([
        supabase.from('properties').select('*, users!properties_owner_id_fkey(full_name, email, phone)'),
        supabase.from('tenants').select('*, rooms(room_number, sharing_type), properties(name)'),
        supabase.from('payment_history').select('*, tenants(name)').eq('status', 'success').order('payment_date', { ascending: false }).limit(500),
        supabase.from('complaints').select('*, tenants(name)').order('created_at', { ascending: false }).limit(200),
        supabase.from('check_out_requests').select('*, tenants(name), rooms(room_number)').order('created_at', { ascending: false }),
        supabase.from('applications').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('applications').select('*').neq('status', 'pending').order('created_at', { ascending: false }).limit(200),
        supabase.from('rooms').select('*, properties(name)'),
        supabase.from('pre_bookings').select('*, rooms(room_number), properties(name)').order('created_at', { ascending: false }),
        supabase.from('notices').select('*, properties(name)').order('created_at', { ascending: false }).limit(200),
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('owner_settings').select('*, users!owner_id(full_name)'),
        supabase.from('membership_plans').select('*'),
        supabase.from('system_settings').select('*').maybeSingle(),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('room_change_requests').select('*, tenants(name), old_room:old_room_id(room_number), new_room:new_room_id(room_number)').order('requested_at', { ascending: false })
      ])

      setProperties(props || [])
      setTenants(tnts || [])
      setPayments(pms || [])
      setComplaints(cmps || [])
      setVacateRequests(vacates || [])
      setApplications(apps || [])
      setApprovedApplications(approvedApps || [])
      setRooms(rms || [])
      setPreBookings(prebooks || [])
      setNotices(notes || [])
      setUsers(usrs || [])
      setOwnerSettings(ownerSet || [])
      setMembershipPlans(plans || [])
      if (sysSet) setSystemSettings(sysSet)
      setAuditLogs(logs || [])
      setRoomChangeRequests(roomChanges || [])

      // Stats
      const totalRevenue = tnts?.reduce((sum, t) => sum + (t.total_paid || 0), 0) || 0
      const totalProperties = props?.length || 0
      const totalTenants = tnts?.length || 0
      const { count: occupiedRooms } = await supabase.from('rooms').select('*', { count: 'exact', head: true }).gt('current_occupants', 0)
      const { count: totalRooms } = await supabase.from('rooms').select('*', { count: 'exact', head: true })
      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0
      const pendingApplications = apps?.length || 0
      const pendingPayments = tnts?.filter(t => t.status === 'payment_pending').length || 0
      const unresolvedComplaints = cmps?.filter(c => c.status === 'open').length || 0
      const pendingMemberships = props?.filter(p => !p.membership_active).length || 0
      const pendingRoomChanges = roomChanges?.filter(r => r.status === 'pending').length || 0

      setStats({
        totalProperties, totalTenants, totalRevenue, occupancyRate,
        pendingApplications, pendingPayments, unresolvedComplaints, pendingMemberships,
        pendingRoomChanges,
      })

      setOccupancyData([
        { name: 'Occupied', value: occupiedRooms },
        { name: 'Vacant', value: totalRooms - occupiedRooms },
      ])

      const monthlyRevenue = {}
      const today = new Date()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthlyRevenue[key] = 0
      }
      pms?.forEach(p => {
        const d = new Date(p.payment_date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (key in monthlyRevenue) monthlyRevenue[key] += p.amount
      })
      setRevenueData(Object.entries(monthlyRevenue).map(([month, revenue]) => ({ month, revenue })))

    } catch (error) {
      console.error('Admin load error:', error)
      toast.error('Failed to load data')
    } finally {
      if (!isSilent) setLoading(false)
    }
  }

  const getDaysUntilVacate = (expectedDate) => {
    const today = new Date()
    const vacateDate = new Date(expectedDate)
    const diffTime = vacateDate - today
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const logAction = async (action, details) => {
    const userId = localStorage.getItem('userId')
    await supabase.from('audit_logs').insert({
      admin_id: userId,
      action,
      details: JSON.stringify(details),
      created_at: new Date().toISOString()
    }).catch(console.error)
  }

  // ---------- Membership actions ----------
  const handleMembershipAction = async (ownerId, action, durationDays = null) => {
    setGrantSubmitting(true)
    const token = (await supabase.auth.getSession()).data.session?.access_token
    const res = await fetch('/api/admin/manage-membership', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ownerId, action, planId: 'monthly', durationDays }),
    })
    const data = await res.json()
    if (data.success) {
      toast.success(data.message)
      logAction(action === 'grant' ? 'grant_membership' : 'revoke_membership', { ownerId, durationDays })
      loadAllData(true)
    } else {
      toast.error(data.error || 'Action failed')
    }
    setGrantSubmitting(false)
    setGrantModal({ show: false, ownerId: null, ownerName: '' })
  }

  const bulkMembershipAction = async (action, durationDays = 30) => {
    if (selectedProperties.length === 0) return toast.error('Select at least one property')
    if (!confirm(`Apply ${action} membership to ${selectedProperties.length} properties?`)) return
    setGrantSubmitting(true)
    for (const prop of selectedProperties) {
      await handleMembershipAction(prop.owner_id, action, durationDays)
    }
    setSelectedProperties([])
    toast.success(`Bulk ${action} completed`)
    setGrantSubmitting(false)
  }

  // ---------- Room change requests ----------
  const approveRoomChange = async (requestId) => {
    if (!confirm('Approve this room change? The tenant will be moved.')) return
    try {
      const { data: req } = await supabase.from('room_change_requests').select('*').eq('id', requestId).single()
      if (!req) throw new Error('Request not found')
      await supabase.from('tenants').update({ room_id: req.new_room_id }).eq('id', req.tenant_id)
      await supabase.rpc('update_room_occupancy_on_change', { old_room_id: req.old_room_id, new_room_id: req.new_room_id })
      await supabase.from('room_change_requests').update({ status: 'approved', processed_at: new Date() }).eq('id', requestId)
      toast.success('Room change approved')
      logAction('approve_room_change', { requestId })
      loadAllData(true)
    } catch (error) {
      toast.error('Failed to approve: ' + error.message)
    }
  }

  const rejectRoomChange = async (requestId) => {
    if (!rejectionReason.trim()) return toast.error('Please provide a reason')
    await supabase.from('room_change_requests').update({ status: 'rejected', processed_at: new Date(), rejection_reason: rejectionReason }).eq('id', requestId)
    toast.success('Room change rejected')
    logAction('reject_room_change', { requestId, reason: rejectionReason })
    setRejectReasonModal({ show: false, requestId: null, type: '' })
    setRejectionReason('')
    loadAllData(true)
  }

  // ---------- Pre‑booking approvals ----------
  const approvePreBooking = async (bookingId) => {
    if (!confirm('Approve this pre‑booking? The tenant will be created.')) return
    try {
      const { error } = await supabase.rpc('admin_approve_prebooking', { booking_id: bookingId })
      if (error) throw error
      toast.success('Pre‑booking approved')
      logAction('approve_prebooking', { bookingId })
      loadAllData(true)
    } catch (err) {
      toast.error('Approval failed: ' + err.message)
    }
  }

  const rejectPreBooking = async (bookingId) => {
    if (!confirm('Reject this pre‑booking?')) return
    await supabase.from('pre_bookings').update({ status: 'rejected' }).eq('id', bookingId)
    toast.success('Pre‑booking rejected')
    logAction('reject_prebooking', { bookingId })
    loadAllData(true)
  }

  // ---------- Application actions ----------
  const approveApplication = async (appId) => {
    if (!confirm('Approve this application? The tenant will be created.')) return
    try {
      const { error } = await supabase.rpc('admin_approve_application', { application_id: appId })
      if (error) throw error
      toast.success('Application approved')
      logAction('approve_application', { appId })
      loadAllData(true)
    } catch (err) {
      toast.error('Approval failed: ' + err.message)
    }
  }

  const rejectApplication = async (appId) => {
    if (!rejectionReason.trim()) return toast.error('Please provide a reason')
    await supabase.from('applications').update({ status: 'rejected', rejection_reason: rejectionReason }).eq('id', appId)
    toast.success('Application rejected')
    logAction('reject_application', { appId, reason: rejectionReason })
    setRejectReasonModal({ show: false, requestId: null, type: '' })
    setRejectionReason('')
    loadAllData(true)
  }

  // ---------- Delete operations ----------
  const deleteProperty = async (propertyId) => {
    if (!confirm('⚠️ This will permanently delete the property and all related data. Cannot undo!')) return
    const { error } = await supabase.from('properties').delete().eq('id', propertyId)
    if (error) toast.error('Failed: ' + error.message)
    else {
      toast.success('Property deleted')
      logAction('delete_property', { propertyId })
      loadAllData(true)
    }
    setDeleteConfirmModal({ show: false, type: '', id: null, name: '' })
  }

  const deleteUser = async (userId) => {
    if (!confirm('Delete this user? All associated data will be removed.')) return
    const { error } = await supabase.from('users').delete().eq('id', userId)
    if (error) toast.error('Failed: ' + error.message)
    else {
      toast.success('User deleted')
      logAction('delete_user', { userId })
      loadAllData(true)
    }
    setDeleteConfirmModal({ show: false, type: '', id: null, name: '' })
  }

  const updateUserRole = async (userId, newRole) => {
    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId)
    if (error) toast.error('Failed to update role')
    else {
      toast.success(`Role updated to ${newRole}`)
      logAction('update_user_role', { userId, newRole })
      loadAllData(true)
    }
  }

  // ---------- Notices ----------
  const postNotice = async () => {
    const propertyId = prompt('Property ID:')
    const title = prompt('Title:')
    const content = prompt('Content:')
    const type = prompt('Type (general/maintenance/payment/event/emergency):')
    const isUrgent = confirm('Is urgent?')
    if (!propertyId || !title || !content) return toast.error('Missing fields')
    const { error } = await supabase.from('notices').insert({
      property_id: propertyId, title, content, type, is_urgent: isUrgent, created_at: new Date().toISOString()
    })
    if (error) toast.error('Failed to post')
    else {
      toast.success('Notice posted')
      logAction('post_notice', { propertyId, title })
      loadAllData(true)
    }
  }

  const deleteNotice = async (noticeId) => {
    if (!confirm('Delete this notice?')) return
    await supabase.from('notices').delete().eq('id', noticeId)
    toast.success('Notice deleted')
    loadAllData(true)
  }

  // ---------- Settings updates ----------
  const updateSystemSettings = async () => {
    const { error } = await supabase.from('system_settings').upsert(systemSettings)
    if (error) toast.error('Failed to update')
    else {
      toast.success('Settings saved')
      logAction('update_system_settings', systemSettings)
      loadAllData(true)
    }
    setEditSettingsModal(false)
  }

  const updateOwnerSettings = async (ownerId, newSettings) => {
    const { error } = await supabase.from('owner_settings').update(newSettings).eq('owner_id', ownerId)
    if (error) toast.error('Failed to update')
    else {
      toast.success('Owner settings updated')
      logAction('update_owner_settings', { ownerId, ...newSettings })
      loadAllData(true)
    }
    setEditOwnerSettingsModal({ show: false, settings: null })
  }

  const updateMembershipPlan = async (plan) => {
    const { error } = await supabase.from('membership_plans').upsert(plan).eq('id', plan.id)
    if (error) toast.error('Failed to update plan')
    else {
      toast.success('Plan updated')
      logAction('update_membership_plan', { planId: plan.id })
      loadAllData(true)
    }
    setEditPlanModal({ show: false, plan: null })
  }

  // ---------- Pagination & filtering ----------
  const filteredProperties = properties.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.city.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.phone.includes(searchTerm)
  )
  const filteredPayments = payments.filter(p =>
    p.tenants?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const paginate = (items) => {
    const start = (currentPage - 1) * itemsPerPage
    return items.slice(start, start + itemsPerPage)
  }

  useEffect(() => {
    const userRole = localStorage.getItem('userRole')
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn || userRole !== 'admin') {
      router.push('/login')
      return
    }
    loadAllData()
    autoRefreshRef.current = setInterval(() => loadAllData(true), 30000)
    return () => clearInterval(autoRefreshRef.current)
  }, [])

  return {
    // State
    loading,
    properties,
    tenants,
    payments,
    complaints,
    vacateRequests,
    applications,
    approvedApplications,
    rooms,
    preBookings,
    notices,
    users,
    ownerSettings,
    membershipPlans,
    systemSettings,
    setSystemSettings,
    auditLogs,
    roomChangeRequests,
    stats,
    revenueData,
    occupancyData,
    activeTab,
    setActiveTab,
    grantModal,
    setGrantModal,
    grantDuration,
    setGrantDuration,
    grantSubmitting,
    selectedProperties,
    setSelectedProperties,
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    editPlanModal,
    setEditPlanModal,
    editSettingsModal,
    setEditSettingsModal,
    editOwnerSettingsModal,
    setEditOwnerSettingsModal,
    deleteConfirmModal,
    setDeleteConfirmModal,
    rejectReasonModal,
    setRejectReasonModal,
    rejectionReason,
    setRejectionReason,
    // Handlers
    loadAllData,
    getDaysUntilVacate,
    logAction,
    handleMembershipAction,
    bulkMembershipAction,
    approveRoomChange,
    rejectRoomChange,
    approvePreBooking,
    rejectPreBooking,
    approveApplication,
    rejectApplication,
    deleteProperty,
    deleteUser,
    updateUserRole,
    postNotice,
    deleteNotice,
    updateSystemSettings,
    updateOwnerSettings,
    updateMembershipPlan,
    filteredProperties,
    filteredTenants,
    filteredPayments,
    paginate,
  }
}
