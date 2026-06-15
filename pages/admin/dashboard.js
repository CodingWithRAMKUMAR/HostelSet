import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

export default function AdminDashboard() {
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

  // UI state
  const [stats, setStats] = useState({
    totalProperties: 0, totalTenants: 0, totalRevenue: 0, occupancyRate: 0,
    pendingApplications: 0, pendingPayments: 0, unresolvedComplaints: 0, pendingMemberships: 0,
    pendingRoomChanges: 0,
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
  const [itemsPerPage] = useState(10)
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
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
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
  const filteredProperties = properties.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.city.toLowerCase().includes(searchTerm.toLowerCase()))
  const filteredTenants = tenants.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.phone.includes(searchTerm))
  const filteredPayments = payments.filter(p => p.tenants?.name?.toLowerCase().includes(searchTerm.toLowerCase()))

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const expiringMemberships = properties.filter(p => {
    if (!p.membership_expiry) return false
    const daysLeft = Math.ceil((new Date(p.membership_expiry) - new Date()) / (1000 * 60 * 60 * 24))
    return daysLeft <= 7 && daysLeft >= 0
  })

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-gray-900/90 backdrop-blur-md border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">🛡️ Admin Dashboard</h1>
        <div className="flex gap-4 items-center">
          <span className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-xs font-bold">Admin</span>
          <button onClick={() => router.push('/')} className="text-purple-400 hover:text-purple-300">View Site</button>
          <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="text-red-400 hover:text-red-300">Logout</button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Quick Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {stats.pendingMemberships > 0 && <div className="bg-yellow-600/20 border border-yellow-600 text-yellow-300 rounded-xl p-3">⭐ {stats.pendingMemberships} owners without membership</div>}
          {stats.pendingPayments > 0 && <div className="bg-red-600/20 border border-red-600 text-red-300 rounded-xl p-3">💰 {stats.pendingPayments} pending payments</div>}
          {stats.pendingApplications > 0 && <div className="bg-blue-600/20 border border-blue-600 text-blue-300 rounded-xl p-3">📋 {stats.pendingApplications} new applications</div>}
          {stats.unresolvedComplaints > 0 && <div className="bg-orange-600/20 border border-orange-600 text-orange-300 rounded-xl p-3">🔧 {stats.unresolvedComplaints} open complaints</div>}
          {stats.pendingRoomChanges > 0 && <div className="bg-purple-600/20 border border-purple-600 text-purple-300 rounded-xl p-3">🔄 {stats.pendingRoomChanges} room change requests</div>}
        </div>

        {/* Membership expiry alerts */}
        {expiringMemberships.length > 0 && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6">
            <h3 className="font-bold text-red-400 mb-2">⚠️ Membership Expiry Alerts</h3>
            <div className="space-y-1">
              {expiringMemberships.map(p => {
                const daysLeft = Math.ceil((new Date(p.membership_expiry) - new Date()) / (1000 * 60 * 60 * 24))
                return (
                  <div key={p.id} className="text-sm">
                    • {p.name} (Owner: {p.users?.full_name}) – expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-purple-800 to-indigo-800 rounded-xl p-5 shadow-lg">
            <p className="text-white/80 text-sm">Properties</p>
            <p className="text-3xl font-bold">{stats.totalProperties}</p>
          </div>
          <div className="bg-gradient-to-br from-pink-800 to-rose-800 rounded-xl p-5 shadow-lg">
            <p className="text-white/80 text-sm">Tenants</p>
            <p className="text-3xl font-bold">{stats.totalTenants}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-800 to-green-800 rounded-xl p-5 shadow-lg">
            <p className="text-white/80 text-sm">Revenue (₹)</p>
            <p className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-800 to-cyan-800 rounded-xl p-5 shadow-lg">
            <p className="text-white/80 text-sm">Occupancy</p>
            <p className="text-3xl font-bold">{stats.occupancyRate}%</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-900 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-4">📊 Monthly Revenue</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-gray-900 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-4">🏠 Occupancy Breakdown</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={occupancyData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {occupancyData.map((entry, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Search & Bulk */}
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <input
            type="text"
            placeholder="🔍 Search..."
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {activeTab === 'properties' && (
            <div className="flex gap-2">
              <button onClick={() => bulkMembershipAction('grant', 30)} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm">Bulk Grant (30d)</button>
              <button onClick={() => bulkMembershipAction('revoke')} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm">Bulk Revoke</button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2">
          {['overview', 'properties', 'tenants', 'payments', 'rooms', 'prebookings', 'applications', 'approved-applications', 'complaints', 'vacate', 'room-changes', 'notices', 'users', 'owner-settings', 'system-settings', 'membership-plans', 'audit-logs'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setCurrentPage(1); setSearchTerm(''); }}
              className={`px-4 py-2 rounded-full text-sm font-semibold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {tab.replace('-', ' ')}
            </button>
          ))}
        </div>

        {/* ========== TAB CONTENT (FULL) ========== */}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-900 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold mb-4">⚡ Recent Activity</h2>
              <div className="space-y-3 text-gray-300">
                {stats.pendingMemberships > 0 && <p className="text-yellow-400">⭐ {stats.pendingMemberships} owners need membership</p>}
                {stats.pendingPayments > 0 && <p className="text-red-400">💰 {stats.pendingPayments} pending payment confirmations</p>}
                {stats.pendingApplications > 0 && <p className="text-blue-400">📋 {stats.pendingApplications} new applications</p>}
                {stats.unresolvedComplaints > 0 && <p className="text-orange-400">🔧 {stats.unresolvedComplaints} open complaints</p>}
                {stats.pendingRoomChanges > 0 && <p className="text-purple-400">🔄 {stats.pendingRoomChanges} room change requests</p>}
              </div>
            </div>
            <div className="bg-gray-900 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold mb-4">📌 Quick Actions</h2>
              <div className="space-y-2 text-gray-300">
                <p>• <strong>Properties</strong> – grant/revoke memberships (bulk available)</p>
                <p>• <strong>Room Changes</strong> – approve/reject tenant requests</p>
                <p>• <strong>Pre‑bookings</strong> – approve/reject directly</p>
                <p>• <strong>Applications</strong> – approve/reject with reason</p>
                <p>• <strong>Vacate</strong> – view days left and status</p>
                <p>• <strong>Users</strong> – change roles, delete</p>
              </div>
            </div>
          </div>
        )}

        {/* Properties Tab */}
        {activeTab === 'properties' && (
          <div className="bg-gray-900 rounded-2xl shadow-xl overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="px-4 py-3"><input type="checkbox" onChange={e => e.target.checked ? setSelectedProperties(filteredProperties) : setSelectedProperties([])} /></th>
                  <th className="px-4 py-3 text-left">Property</th>
                  <th className="px-4 py-3 text-left">Owner</th>
                  <th className="px-4 py-3 text-left">City</th>
                  <th className="px-4 py-3 text-left">Membership</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginate(filteredProperties).map(p => (
                  <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="px-4 py-3"><input type="checkbox" checked={selectedProperties.includes(p)} onChange={e => {
                      if (e.target.checked) setSelectedProperties([...selectedProperties, p])
                      else setSelectedProperties(selectedProperties.filter(sp => sp.id !== p.id))
                    }} /></td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-400">{p.users?.full_name || 'N/A'}<br/><span className="text-xs">{p.users?.email}</span></td>
                    <td className="px-4 py-3">{p.city}</td>
                    <td className="px-4 py-3">{p.membership_active ? <span className="text-green-400">Active until {formatDate(p.membership_expiry)}</span> : <span className="text-red-400">Inactive</span>}</td>
                    <td className="px-4 py-3 flex gap-2">
                      {p.membership_active ? (
                        <button onClick={() => handleMembershipAction(p.owner_id, 'revoke')} className="bg-red-700 hover:bg-red-600 px-2 py-1 rounded text-xs">Revoke</button>
                      ) : (
                        <button onClick={() => setGrantModal({ show: true, ownerId: p.owner_id, ownerName: p.users?.full_name || 'Owner' })} className="bg-purple-700 hover:bg-purple-600 px-2 py-1 rounded text-xs">Grant</button>
                      )}
                      <button onClick={() => setDeleteConfirmModal({ show: true, type: 'property', id: p.id, name: p.name })} className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between p-4">
              <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50">Prev</button>
              <span>Page {currentPage} of {Math.ceil(filteredProperties.length/itemsPerPage)}</span>
              <button onClick={() => setCurrentPage(p => p+1)} disabled={currentPage>=Math.ceil(filteredProperties.length/itemsPerPage)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50">Next</button>
            </div>
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === 'tenants' && (
          <div className="bg-gray-900 rounded-2xl shadow-xl overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Phone</th><th className="px-4 py-3 text-left">Room</th><th className="px-4 py-3 text-left">Property</th><th className="px-4 py-3 text-left">Move‑in</th><th className="px-4 py-3 text-left">Rent</th><th className="px-4 py-3 text-left">Status</th></tr>
              </thead>
              <tbody>
                {paginate(filteredTenants).map(t => (
                  <tr key={t.id} className="border-b border-gray-800">
                    <td className="px-4 py-3">{t.name}</td>
                    <td className="px-4 py-3">{t.phone}</td>
                    <td className="px-4 py-3">{t.rooms?.room_number || 'N/A'}</td>
                    <td className="px-4 py-3">{t.properties?.name || 'N/A'}</td>
                    <td className="px-4 py-3">{formatDate(t.move_in_date)}</td>
                    <td className="px-4 py-3">{formatCurrency(t.rent_amount)}</td>
                    <td className="px-4 py-3">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between p-4">{/* pagination same as above */}</div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="bg-gray-900 rounded-2xl shadow-xl overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr><th className="px-4 py-3">Date</th><th>Tenant</th><th>Amount</th><th>Method</th><th>Status</th></tr>
              </thead>
              <tbody>
                {paginate(filteredPayments).map(p => (
                  <tr key={p.id} className="border-b border-gray-800">
                    <td className="px-4 py-3">{formatDate(p.payment_date)}</td>
                    <td className="px-4 py-3">{p.tenants?.name}</td>
                    <td className="px-4 py-3 text-green-400">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 capitalize">{p.payment_method}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 bg-green-800 text-green-200 rounded-full text-xs">{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div className="bg-gray-900 rounded-2xl shadow-xl overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr><th>Room No.</th><th>Property</th><th>Sharing</th><th>Rent (₹)</th><th>Occupancy</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {rooms.map(room => (
                  <tr key={room.id} className="border-b border-gray-800">
                    <td className="px-4 py-3">{room.room_number}</td>
                    <td className="px-4 py-3">{room.properties?.name}</td>
                    <td className="px-4 py-3">{room.sharing_type}</td>
                    <td className="px-4 py-3">{formatCurrency(room.monthly_rent)}</td>
                    <td className="px-4 py-3">{room.current_occupants}/{room.capacity}</td>
                    <td className="px-4 py-3"><button onClick={() => setDeleteConfirmModal({ show: true, type: 'room', id: room.id, name: `Room ${room.room_number}` })} className="text-red-400 text-sm">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pre‑bookings Tab */}
        {activeTab === 'prebookings' && (
          <div className="space-y-4">
            {preBookings.map(b => (
              <div key={b.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex justify-between items-start">
                <div>
                  <p className="font-semibold">{b.name}</p>
                  <p className="text-sm text-gray-400">📞 {b.phone} | 📧 {b.email}</p>
                  <p className="text-sm">Room {b.rooms?.room_number} - {b.properties?.name}</p>
                  <p className="text-sm">Expected move‑in: {formatDate(b.expected_move_in_date)}</p>
                  <p className="text-sm">Pre‑booking fee: {formatCurrency(b.pre_booking_fee_amount)}</p>
                  <p className="text-xs text-gray-500">Status: {b.status} | Payment: {b.payment_status}</p>
                  {b.payment_screenshot && <a href={b.payment_screenshot} target="_blank" className="text-purple-400 text-xs">View Screenshot</a>}
                </div>
                {b.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => approvePreBooking(b.id)} className="bg-green-700 hover:bg-green-600 px-3 py-1 rounded text-xs">Approve</button>
                    <button onClick={() => rejectPreBooking(b.id)} className="bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-xs">Reject</button>
                  </div>
                )}
                {b.status === 'approved' && <span className="text-green-400 text-xs">✅ Approved</span>}
                {b.status === 'rejected' && <span className="text-red-400 text-xs">❌ Rejected</span>}
              </div>
            ))}
            {preBookings.length === 0 && <p className="text-center text-gray-500">No pre‑bookings</p>}
          </div>
        )}

        {/* Applications (pending) Tab */}
        {activeTab === 'applications' && (
          <div className="space-y-4">
            {applications.map(app => (
              <div key={app.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex justify-between items-start">
                <div>
                  <p className="font-semibold">{app.name}</p>
                  <p className="text-sm text-gray-400">📞 {app.phone}</p>
                  <p className="text-xs text-gray-500">Applied: {formatDate(app.created_at)}</p>
                  {app.message && <p className="text-sm text-gray-500">💬 {app.message}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveApplication(app.id)} className="bg-green-700 hover:bg-green-600 px-3 py-1 rounded text-xs">Approve</button>
                  <button onClick={() => { setRejectReasonModal({ show: true, requestId: app.id, type: 'application' }); setRejectionReason(''); }} className="bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-xs">Reject</button>
                </div>
              </div>
            ))}
            {applications.length === 0 && <p className="text-center text-gray-500">No pending applications</p>}
          </div>
        )}

        {/* Approved Applications Tab */}
        {activeTab === 'approved-applications' && (
          <div className="bg-gray-900 rounded-2xl shadow-xl overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 border-b">
                <tr><th>Name</th><th>Phone</th><th>Status</th><th>Processed Date</th></tr>
              </thead>
              <tbody>
                {approvedApplications.map(app => (
                  <tr key={app.id} className="border-b border-gray-800">
                    <td className="px-4 py-3">{app.name}</td>
                    <td>{app.phone}</td>
                    <td>{app.status}</td>
                    <td>{formatDate(app.processed_at || app.created_at)}</td>
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
              <div key={c.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex justify-between items-start">
                <div>
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-sm text-gray-400">From: {c.tenants?.name || c.tenant_name}</p>
                  <p className="text-sm">{c.description}</p>
                  <span className={`px-2 py-1 rounded-full text-xs ${c.status === 'open' ? 'bg-red-800 text-red-200' : c.status === 'in_progress' ? 'bg-yellow-800 text-yellow-200' : 'bg-green-800 text-green-200'}`}>{c.status}</span>
                </div>
                <button onClick={() => {
                  if (confirm('Delete this complaint?')) supabase.from('complaints').delete().eq('id', c.id).then(() => loadAllData(true))
                }} className="text-red-400 text-sm">Delete</button>
              </div>
            ))}
            {complaints.length === 0 && <p className="text-center text-gray-500">No complaints</p>}
          </div>
        )}

        {/* Vacate Tab */}
        {activeTab === 'vacate' && (
          <div className="space-y-4">
            {vacateRequests.map(v => {
              const daysLeft = getDaysUntilVacate(v.expected_check_out)
              return (
                <div key={v.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{v.tenants?.name || v.tenant_name}</p>
                      <p className="text-sm text-gray-400">Room {v.rooms?.room_number || v.room_number}</p>
                      <p className="text-sm">Expected: {formatDate(v.expected_check_out)}</p>
                      <p className={`text-xs font-bold ${daysLeft > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {daysLeft > 0 ? `🚪 Vacates in ${daysLeft} days` : `⚠️ Overdue by ${Math.abs(daysLeft)} days`}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${v.status === 'approved' ? 'bg-green-800 text-green-200' : v.status === 'pending' ? 'bg-yellow-800 text-yellow-200' : 'bg-gray-700'}`}>{v.status}</span>
                  </div>
                </div>
              )
            })}
            {vacateRequests.length === 0 && <p className="text-center text-gray-500">No vacate requests</p>}
          </div>
        )}

        {/* Room Changes Tab */}
        {activeTab === 'room-changes' && (
          <div className="space-y-4">
            {roomChangeRequests.map(req => {
              const tenant = req.tenants
              return (
                <div key={req.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{tenant?.name || 'Unknown'}</p>
                      <p className="text-sm text-gray-400">From Room {req.old_room?.room_number} → To Room {req.new_room?.room_number}</p>
                      {req.reason && <p className="text-sm text-gray-500">Reason: {req.reason}</p>}
                      <p className="text-xs text-gray-500">Requested: {formatDate(req.requested_at)}</p>
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => approveRoomChange(req.id)} className="bg-green-700 hover:bg-green-600 px-3 py-1 rounded text-xs">Approve</button>
                        <button onClick={() => { setRejectReasonModal({ show: true, requestId: req.id, type: 'roomchange' }); setRejectionReason(''); }} className="bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-xs">Reject</button>
                      </div>
                    )}
                    {req.status === 'approved' && <span className="text-green-400 text-xs">✅ Approved</span>}
                    {req.status === 'rejected' && <span className="text-red-400 text-xs">❌ Rejected: {req.rejection_reason}</span>}
                  </div>
                </div>
              )
            })}
            {roomChangeRequests.length === 0 && <p className="text-center text-gray-500">No room change requests</p>}
          </div>
        )}

        {/* Notices Tab */}
        {activeTab === 'notices' && (
          <div className="space-y-4">
            <button onClick={postNotice} className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded-lg mb-4">+ Post Notice</button>
            {notices.map(n => (
              <div key={n.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex justify-between items-start">
                <div>
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-sm text-gray-400">{n.properties?.name} • {n.type}</p>
                  <p className="text-sm">{n.content}</p>
                  <p className="text-xs text-gray-500">{formatDate(n.created_at)}</p>
                </div>
                <button onClick={() => deleteNotice(n.id)} className="text-red-400 text-sm">Delete</button>
              </div>
            ))}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-gray-900 rounded-2xl shadow-xl overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 border-b">
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-gray-800">
                    <td className="px-4 py-3">{u.full_name}</td>
                    <td>{u.email}</td>
                    <td>{u.phone}</td>
                    <td>
                      <select value={u.role} onChange={e => updateUserRole(u.id, e.target.value)} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm">
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                        <option value="tenant">Tenant</option>
                      </select>
                    </td>
                    <td><button onClick={() => setDeleteConfirmModal({ show: true, type: 'user', id: u.id, name: u.full_name })} className="text-red-400 text-sm">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Owner Settings Tab */}
        {activeTab === 'owner-settings' && (
          <div className="bg-gray-900 rounded-2xl shadow-xl overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 border-b">
                <tr><th>Owner</th><th>UPI ID</th><th>UPI Phone</th><th>Joining Fee</th><th>Advance Months</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {ownerSettings.map(os => (
                  <tr key={os.owner_id} className="border-b border-gray-800">
                    <td className="px-4 py-3">{os.users?.full_name}</td>
                    <td>{os.upi_id || '—'}</td>
                    <td>{os.upi_phone || '—'}</td>
                    <td>{formatCurrency(os.joining_fee || 0)}</td>
                    <td>{os.advance_months || 1}</td>
                    <td><button onClick={() => setEditOwnerSettingsModal({ show: true, settings: os })} className="text-blue-400 text-sm">Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* System Settings Tab */}
        {activeTab === 'system-settings' && (
          <div className="bg-gray-900 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">⚙️ Global System Settings</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Pre‑booking Fee (₹)</label><input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white" value={systemSettings.pre_booking_fee} onChange={e => setSystemSettings({...systemSettings, pre_booking_fee: parseInt(e.target.value)})} /></div>
              <div><label className="block text-sm font-medium mb-1">Max Advance Months (for new tenants)</label><input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white" value={systemSettings.max_advance_months} onChange={e => setSystemSettings({...systemSettings, max_advance_months: parseInt(e.target.value)})} /></div>
              <div><label className="block text-sm font-medium mb-1">Due Alert Threshold (days)</label><input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white" value={systemSettings.due_alert_days} onChange={e => setSystemSettings({...systemSettings, due_alert_days: parseInt(e.target.value)})} /></div>
              <button onClick={updateSystemSettings} className="bg-purple-700 hover:bg-purple-600 text-white px-6 py-2 rounded-lg">Save Settings</button>
            </div>
          </div>
        )}

        {/* Membership Plans Tab */}
        {activeTab === 'membership-plans' && (
          <div className="grid md:grid-cols-2 gap-6">
            {membershipPlans.map(plan => (
              <div key={plan.id} className="bg-gray-900 rounded-2xl p-6 shadow-xl">
                <h2 className="text-2xl font-bold">{plan.name}</h2>
                <p className="text-3xl font-bold text-purple-400">₹{plan.price}<span className="text-sm text-gray-400">/{plan.id === 'monthly' ? 'month' : 'year'}</span></p>
                <ul className="mt-4 space-y-1 text-gray-300">
                  {plan.features?.map((f, i) => <li key={i}>✓ {f}</li>)}
                </ul>
                <button onClick={() => setEditPlanModal({ show: true, plan })} className="mt-4 bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">Edit Plan</button>
              </div>
            ))}
          </div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === 'audit-logs' && (
          <div className="bg-gray-900 rounded-2xl shadow-xl overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 border-b">
                <tr><th>Time</th><th>Action</th><th>Details</th></tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id} className="border-b border-gray-800">
                    <td className="px-4 py-3 text-sm">{formatDate(log.created_at)}</td>
                    <td className="font-mono text-sm">{log.action}</td>
                    <td className="text-sm">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========== MODALS ========== */}

      {/* Grant Membership Modal */}
      <AnimatePresence>
        {grantModal.show && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setGrantModal({ show: false, ownerId: null, ownerName: '' })}>
            <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-800" onClick={e => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Grant Membership</h2>
              <p>Owner: <strong>{grantModal.ownerName}</strong></p>
              <div className="my-4"><label>Duration (days)</label><input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white" value={grantDuration} onChange={e => setGrantDuration(parseInt(e.target.value) || 30)} min={1} /></div>
              <div className="flex gap-3">
                <button onClick={() => handleMembershipAction(grantModal.ownerId, 'grant', grantDuration)} disabled={grantSubmitting} className="bg-purple-700 hover:bg-purple-600 text-white py-2 rounded-lg flex-1">Grant</button>
                <button onClick={() => setGrantModal({ show: false, ownerId: null, ownerName: '' })} className="border border-gray-700 py-2 rounded-lg flex-1">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Reason Modal */}
      <AnimatePresence>
        {rejectReasonModal.show && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setRejectReasonModal({ show: false, requestId: null, type: '' })}>
            <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-800" onClick={e => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Rejection Reason</h2>
              <textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 h-24" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Why are you rejecting this?" />
              <div className="flex gap-3 mt-4">
                <button onClick={() => {
                  if (rejectReasonModal.type === 'application') rejectApplication(rejectReasonModal.requestId)
                  else if (rejectReasonModal.type === 'roomchange') rejectRoomChange(rejectReasonModal.requestId)
                }} className="bg-red-700 hover:bg-red-600 text-white py-2 rounded-lg flex-1">Confirm Reject</button>
                <button onClick={() => setRejectReasonModal({ show: false, requestId: null, type: '' })} className="border border-gray-700 py-2 rounded-lg flex-1">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Plan Modal */}
      <AnimatePresence>
        {editPlanModal.show && editPlanModal.plan && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setEditPlanModal({ show: false, plan: null })}>
            <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-800" onClick={e => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Edit {editPlanModal.plan.name}</h2>
              <div><label>Price (₹)</label><input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2" value={editPlanModal.plan.price} onChange={e => setEditPlanModal({...editPlanModal, plan: {...editPlanModal.plan, price: parseInt(e.target.value)}})} /></div>
              <div><label>Features (comma separated)</label><input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2" value={editPlanModal.plan.features?.join(', ')} onChange={e => setEditPlanModal({...editPlanModal, plan: {...editPlanModal.plan, features: e.target.value.split(',').map(f=>f.trim())}})} /></div>
              <div className="flex gap-3 mt-4"><button onClick={() => updateMembershipPlan(editPlanModal.plan)} className="bg-purple-700 text-white px-4 py-2 rounded-lg">Save</button><button onClick={() => setEditPlanModal({ show: false, plan: null })} className="border border-gray-700 px-4 py-2 rounded-lg">Cancel</button></div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Owner Settings Modal */}
      <AnimatePresence>
        {editOwnerSettingsModal.show && editOwnerSettingsModal.settings && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setEditOwnerSettingsModal({ show: false, settings: null })}>
            <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-800" onClick={e => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Edit Owner Settings</h2>
              <div><label>UPI ID</label><input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2" value={editOwnerSettingsModal.settings.upi_id || ''} onChange={e => setEditOwnerSettingsModal({...editOwnerSettingsModal, settings: {...editOwnerSettingsModal.settings, upi_id: e.target.value}})} /></div>
              <div><label>UPI Phone</label><input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2" value={editOwnerSettingsModal.settings.upi_phone || ''} onChange={e => setEditOwnerSettingsModal({...editOwnerSettingsModal, settings: {...editOwnerSettingsModal.settings, upi_phone: e.target.value}})} /></div>
              <div><label>Joining Fee (₹)</label><input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2" value={editOwnerSettingsModal.settings.joining_fee || 0} onChange={e => setEditOwnerSettingsModal({...editOwnerSettingsModal, settings: {...editOwnerSettingsModal.settings, joining_fee: parseInt(e.target.value)}})} /></div>
              <div><label>Advance Months</label><input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2" value={editOwnerSettingsModal.settings.advance_months || 1} onChange={e => setEditOwnerSettingsModal({...editOwnerSettingsModal, settings: {...editOwnerSettingsModal.settings, advance_months: parseInt(e.target.value)}})} /></div>
              <div className="flex gap-3 mt-4"><button onClick={() => updateOwnerSettings(editOwnerSettingsModal.settings.owner_id, editOwnerSettingsModal.settings)} className="bg-purple-700 text-white px-4 py-2 rounded-lg">Save</button><button onClick={() => setEditOwnerSettingsModal({ show: false, settings: null })} className="border border-gray-700 px-4 py-2 rounded-lg">Cancel</button></div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmModal.show && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirmModal({ show: false, type: '', id: null, name: '' })}>
            <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-800">
              <h2 className="text-2xl font-bold mb-4 text-red-400">Confirm Deletion</h2>
              <p>Are you sure you want to delete <strong>{deleteConfirmModal.name}</strong>? This action cannot be undone.</p>
              <div className="flex gap-3 mt-6">
                <button onClick={() => {
                  if (deleteConfirmModal.type === 'property') deleteProperty(deleteConfirmModal.id)
                  else if (deleteConfirmModal.type === 'user') deleteUser(deleteConfirmModal.id)
                  else setDeleteConfirmModal({ show: false, type: '', id: null, name: '' })
                }} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg">Delete</button>
                <button onClick={() => setDeleteConfirmModal({ show: false, type: '', id: null, name: '' })} className="border border-gray-700 px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
