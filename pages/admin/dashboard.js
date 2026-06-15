import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts'

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

export default function AdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  
  // Data states
  const [properties, setProperties] = useState([])
  const [tenants, setTenants] = useState([])
  const [payments, setPayments] = useState([])
  const [complaints, setComplaints] = useState([])
  const [vacateRequests, setVacateRequests] = useState([])
  const [applications, setApplications] = useState([])
  const [rooms, setRooms] = useState([])
  const [preBookings, setPreBookings] = useState([])
  const [notices, setNotices] = useState([])
  const [users, setUsers] = useState([])
  const [ownerSettings, setOwnerSettings] = useState([])
  const [membershipPlans, setMembershipPlans] = useState([])
  const [systemSettings, setSystemSettings] = useState({ pre_booking_fee: 999, max_advance_months: 6, due_alert_days: 5 })
  const [auditLogs, setAuditLogs] = useState([])
  
  // UI states
  const [stats, setStats] = useState({
    totalProperties: 0, totalTenants: 0, totalRevenue: 0, occupancyRate: 0,
    pendingApplications: 0, pendingPayments: 0, unresolvedComplaints: 0, pendingMemberships: 0,
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
  const autoRefreshRef = useRef(null)

  // Dark mode from localStorage
  useEffect(() => {
    const savedDark = localStorage.getItem('adminDarkMode') === 'true'
    setDarkMode(savedDark)
    if (savedDark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [])

  const toggleDarkMode = () => {
    const newDark = !darkMode
    setDarkMode(newDark)
    localStorage.setItem('adminDarkMode', newDark)
    if (newDark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
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
        { data: rms },
        { data: prebooks },
        { data: notes },
        { data: usrs },
        { data: ownerSet },
        { data: plans },
        { data: sysSet },
        { data: logs }
      ] = await Promise.all([
        supabase.from('properties').select('*, users!properties_owner_id_fkey(full_name, email, phone)'),
        supabase.from('tenants').select('*, rooms(room_number, sharing_type), properties(name)'),
        supabase.from('payment_history').select('*, tenants(name)').eq('status', 'success').order('payment_date', { ascending: false }).limit(500),
        supabase.from('complaints').select('*, tenants(name)').order('created_at', { ascending: false }).limit(200),
        supabase.from('check_out_requests').select('*, tenants(name), rooms(room_number)').order('created_at', { ascending: false }).limit(200),
        supabase.from('applications').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('rooms').select('*, properties(name)'),
        supabase.from('pre_bookings').select('*, rooms(room_number), properties(name)').order('created_at', { ascending: false }).limit(200),
        supabase.from('notices').select('*, properties(name)').order('created_at', { ascending: false }).limit(200),
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('owner_settings').select('*, users!owner_id(full_name)'),
        supabase.from('membership_plans').select('*'),
        supabase.from('system_settings').select('*').maybeSingle(),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100)
      ])

      setProperties(props || [])
      setTenants(tnts || [])
      setPayments(pms || [])
      setComplaints(cmps || [])
      setVacateRequests(vacates || [])
      setApplications(apps || [])
      setRooms(rms || [])
      setPreBookings(prebooks || [])
      setNotices(notes || [])
      setUsers(usrs || [])
      setOwnerSettings(ownerSet || [])
      setMembershipPlans(plans || [
        { id: 'monthly', name: 'Monthly Plan', price: 499, features: ['Basic support', 'Up to 50 tenants'], is_active: true },
        { id: 'yearly', name: 'Yearly Plan', price: 4999, features: ['Priority support', 'Unlimited tenants', 'Analytics dashboard'], is_active: true }
      ])
      if (sysSet) setSystemSettings(sysSet)
      setAuditLogs(logs || [])

      // Calculate stats
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

      setStats({
        totalProperties, totalTenants, totalRevenue, occupancyRate,
        pendingApplications, pendingPayments, unresolvedComplaints, pendingMemberships,
      })

      setOccupancyData([
        { name: 'Occupied', value: occupiedRooms },
        { name: 'Vacant', value: totalRooms - occupiedRooms },
      ])

      // Monthly revenue
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

  // Log admin action
  const logAction = async (action, details) => {
    const userId = localStorage.getItem('userId')
    await supabase.from('audit_logs').insert({
      admin_id: userId,
      action,
      details,
      created_at: new Date().toISOString()
    }).catch(console.error)
  }

  // Membership actions
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

  // Bulk membership
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

  // Delete property (force)
  const deleteProperty = async (propertyId) => {
    if (!confirm('⚠️ This will permanently delete the property, all rooms, tenants, payments, complaints, notices, applications, pre-bookings. This cannot be undone!')) return
    const { error } = await supabase.from('properties').delete().eq('id', propertyId)
    if (error) toast.error('Failed to delete property: ' + error.message)
    else {
      toast.success('Property deleted')
      logAction('delete_property', { propertyId })
      loadAllData(true)
    }
    setDeleteConfirmModal({ show: false, type: '', id: null, name: '' })
  }

  // Delete user
  const deleteUser = async (userId) => {
    if (!confirm('Delete this user? All associated data will be removed.')) return
    const { error } = await supabase.from('users').delete().eq('id', userId)
    if (error) toast.error('Failed to delete user')
    else {
      toast.success('User deleted')
      logAction('delete_user', { userId })
      loadAllData(true)
    }
    setDeleteConfirmModal({ show: false, type: '', id: null, name: '' })
  }

  // Update role
  const updateUserRole = async (userId, newRole) => {
    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId)
    if (error) toast.error('Failed to update role')
    else {
      toast.success(`Role updated to ${newRole}`)
      logAction('update_user_role', { userId, newRole })
      loadAllData(true)
    }
  }

  // Approve/reject pre-booking
  const approvePreBooking = async (bookingId, roomId, userId) => {
    if (!confirm('Approve this pre‑booking? The tenant will be created.')) return
    const { error } = await supabase.rpc('admin_approve_prebooking', { booking_id: bookingId })
    if (error) toast.error('Approval failed: ' + error.message)
    else {
      toast.success('Pre‑booking approved')
      logAction('approve_prebooking', { bookingId })
      loadAllData(true)
    }
  }

  const rejectPreBooking = async (bookingId) => {
    if (!confirm('Reject this pre‑booking?')) return
    const { error } = await supabase.from('pre_bookings').update({ status: 'rejected' }).eq('id', bookingId)
    if (error) toast.error('Rejection failed')
    else {
      toast.success('Pre‑booking rejected')
      logAction('reject_prebooking', { bookingId })
      loadAllData(true)
    }
  }

  // Post/delete notice
  const postNotice = async (propertyId, title, content, type, isUrgent) => {
    const { error } = await supabase.from('notices').insert({
      property_id: propertyId, title, content, type, is_urgent: isUrgent, created_at: new Date().toISOString()
    })
    if (error) toast.error('Failed to post notice')
    else {
      toast.success('Notice posted')
      logAction('post_notice', { propertyId, title })
      loadAllData(true)
    }
  }

  const deleteNotice = async (noticeId) => {
    if (!confirm('Delete this notice?')) return
    const { error } = await supabase.from('notices').delete().eq('id', noticeId)
    if (error) toast.error('Failed to delete')
    else {
      toast.success('Notice deleted')
      loadAllData(true)
    }
  }

  // Update membership plan
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

  // Update system settings
  const updateSystemSettings = async () => {
    const { error } = await supabase.from('system_settings').upsert(systemSettings)
    if (error) toast.error('Failed to update settings')
    else {
      toast.success('Settings saved')
      logAction('update_system_settings', systemSettings)
      loadAllData(true)
    }
    setEditSettingsModal(false)
  }

  // Update owner settings
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

  // Export CSV
  const exportCSV = (data, filename) => {
    const headers = Object.keys(data[0] || {}).join(',')
    const rows = data.map(row => Object.values(row).join(',')).join('\n')
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Pagination helper
  const paginate = (items) => {
    const start = (currentPage - 1) * itemsPerPage
    return items.slice(start, start + itemsPerPage)
  }

  // Filtering
  const filteredProperties = properties.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.city.toLowerCase().includes(searchTerm.toLowerCase()))
  const filteredTenants = tenants.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.phone.includes(searchTerm))
  const filteredPayments = payments.filter(p => p.tenants?.name?.toLowerCase().includes(searchTerm.toLowerCase()))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="w-16 h-16 border-4 border-white border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-gray-900' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}>
      {/* Navbar */}
      <nav className={`sticky top-0 z-50 backdrop-blur-md shadow-sm px-6 py-4 flex justify-between items-center border-b ${darkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-200'}`}>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">🛡️ Admin Dashboard</h1>
        <div className="flex gap-4 items-center">
          <button onClick={toggleDarkMode} className="text-2xl">
            {darkMode ? '☀️' : '🌙'}
          </button>
          <span className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-xs font-bold shadow">Admin</span>
          <button onClick={() => router.push('/')} className="text-blue-500 hover:text-blue-700">View Site</button>
          <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="text-red-500 hover:text-red-700 font-medium">Logout</button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Quick Alerts Banner */}
        {(stats.pendingMemberships > 0 || stats.pendingPayments > 0 || stats.pendingApplications > 0 || stats.unresolvedComplaints > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.pendingMemberships > 0 && (
              <motion.div className={`p-4 rounded-xl shadow-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-white`}>
                ⭐ {stats.pendingMemberships} owner(s) without membership
              </motion.div>
            )}
            {stats.pendingPayments > 0 && (
              <motion.div className="bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl p-4 shadow-lg">
                💰 {stats.pendingPayments} pending payment confirmations
              </motion.div>
            )}
            {stats.pendingApplications > 0 && (
              <motion.div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl p-4 shadow-lg">
                📋 {stats.pendingApplications} new application(s)
              </motion.div>
            )}
            {stats.unresolvedComplaints > 0 && (
              <motion.div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl p-4 shadow-lg">
                🔧 {stats.unresolvedComplaints} unresolved complaint(s)
              </motion.div>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-xl p-5 shadow-lg hover:shadow-2xl transition">
            <p className="text-white/80 text-sm">Properties</p>
            <p className="text-3xl font-bold">{stats.totalProperties}</p>
          </div>
          <div className="bg-gradient-to-br from-pink-600 to-rose-600 text-white rounded-xl p-5 shadow-lg hover:shadow-2xl transition">
            <p className="text-white/80 text-sm">Tenants</p>
            <p className="text-3xl font-bold">{stats.totalTenants}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-600 to-green-600 text-white rounded-xl p-5 shadow-lg hover:shadow-2xl transition">
            <p className="text-white/80 text-sm">Revenue (₹)</p>
            <p className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-cyan-600 text-white rounded-xl p-5 shadow-lg hover:shadow-2xl transition">
            <p className="text-white/80 text-sm">Occupancy</p>
            <p className="text-3xl font-bold">{stats.occupancyRate}%</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className={`rounded-2xl p-6 shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-xl font-bold mb-4">📊 Monthly Revenue</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="month" stroke={darkMode ? '#9ca3af' : '#4b5563'} />
                <YAxis stroke={darkMode ? '#9ca3af' : '#4b5563'} />
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className={`rounded-2xl p-6 shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-xl font-bold mb-4">🏠 Occupancy Breakdown</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={occupancyData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {occupancyData.map((entry, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Search & Bulk Actions */}
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <input
            type="text"
            placeholder="🔍 Search..."
            className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300'}`}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {activeTab === 'properties' && (
            <div className="flex gap-2">
              <button onClick={() => bulkMembershipAction('grant', 30)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm">Bulk Grant (30d)</button>
              <button onClick={() => bulkMembershipAction('revoke')} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm">Bulk Revoke</button>
              <button onClick={() => exportCSV(properties, 'properties')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Export CSV</button>
            </div>
          )}
          {activeTab === 'tenants' && <button onClick={() => exportCSV(tenants, 'tenants')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Export CSV</button>}
          {activeTab === 'payments' && <button onClick={() => exportCSV(payments, 'payments')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Export CSV</button>}
        </div>

        {/* Tabs – extended */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['overview', 'properties', 'tenants', 'payments', 'rooms', 'prebookings', 'applications', 'complaints', 'vacate', 'notices', 'users', 'owner-settings', 'system-settings', 'membership-plans', 'audit-logs'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setCurrentPage(1); setSearchTerm(''); }}
              className={`px-4 py-2 rounded-full text-sm font-semibold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                  : `${darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-100'} shadow-sm`
              }`}
            >
              {tab.replace('-', ' ')}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className={`rounded-2xl p-6 shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h2 className="text-xl font-bold mb-4">⚡ Recent Activity</h2>
              <div className="space-y-3">
                {stats.pendingMemberships > 0 && <p className="text-amber-600">⭐ {stats.pendingMemberships} owners need membership</p>}
                {stats.pendingPayments > 0 && <p className="text-red-600">💰 {stats.pendingPayments} pending payment confirmations</p>}
                {stats.pendingApplications > 0 && <p className="text-blue-600">📋 {stats.pendingApplications} new applications</p>}
                {stats.unresolvedComplaints > 0 && <p className="text-orange-600">🔧 {stats.unresolvedComplaints} open complaints</p>}
              </div>
            </div>
            <div className={`rounded-2xl p-6 shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h2 className="text-xl font-bold mb-4">📌 Quick Actions</h2>
              <div className="space-y-2 text-gray-600 dark:text-gray-300">
                <p>• Use <strong>Properties</strong> tab to manage memberships (bulk available).</p>
                <p>• <strong>Rooms</strong> tab – edit/delete any room.</p>
                <p>• <strong>Pre‑bookings</strong> – approve/reject directly.</p>
                <p>• <strong>Users</strong> – change roles, delete, reset password.</p>
                <p>• <strong>System Settings</strong> – change global parameters.</p>
              </div>
            </div>
          </div>
        )}

        {/* Properties Tab – with checkboxes for bulk actions */}
        {activeTab === 'properties' && (
          <div className={`rounded-2xl shadow-lg overflow-x-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <table className="w-full">
              <thead className={`border-b ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50'}`}>
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold"><input type="checkbox" onChange={e => {
                    if (e.target.checked) setSelectedProperties(filteredProperties)
                    else setSelectedProperties([])
                  }} /></th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Property</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Owner</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">City</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Membership</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginate(filteredProperties).map(p => (
                  <tr key={p.id} className={`border-b ${darkMode ? 'border-gray-700 hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3"><input type="checkbox" checked={selectedProperties.includes(p)} onChange={e => {
                      if (e.target.checked) setSelectedProperties([...selectedProperties, p])
                      else setSelectedProperties(selectedProperties.filter(sp => sp.id !== p.id))
                    }} /></td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.users?.full_name || 'N/A'}<br/><span className="text-xs">{p.users?.email}</span></td>
                    <td className="px-4 py-3">{p.city}</td>
                    <td className="px-4 py-3">{p.membership_active ? <span className="text-green-600">Active until {formatDate(p.membership_expiry)}</span> : <span className="text-red-500">Inactive</span>}</td>
                    <td className="px-4 py-3 flex gap-2">
                      {p.membership_active ? (
                        <button onClick={() => handleMembershipAction(p.owner_id, 'revoke')} className="text-xs bg-red-500 text-white px-3 py-1 rounded-full">Revoke</button>
                      ) : (
                        <button onClick={() => setGrantModal({ show: true, ownerId: p.owner_id, ownerName: p.users?.full_name || 'Owner' })} className="text-xs bg-purple-600 text-white px-3 py-1 rounded-full">Grant</button>
                      )}
                      <button onClick={() => setDeleteConfirmModal({ show: true, type: 'property', id: p.id, name: p.name })} className="text-xs bg-gray-500 text-white px-3 py-1 rounded-full">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between p-4">
              <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50">Prev</button>
              <span>Page {currentPage} of {Math.ceil(filteredProperties.length/itemsPerPage)}</span>
              <button onClick={() => setCurrentPage(p => p+1)} disabled={currentPage>=Math.ceil(filteredProperties.length/itemsPerPage)} className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50">Next</button>
            </div>
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === 'tenants' && (
          <div className={`rounded-2xl shadow-lg overflow-x-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <table className="w-full">
              <thead className={`border-b ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr><th className="px-4 py-3">Name</th><th>Phone</th><th>Room</th><th>Property</th><th>Status</th></tr>
              </thead>
              <tbody>
                {paginate(filteredTenants).map(t => (
                  <tr key={t.id} className={`border-b ${darkMode ? 'border-gray-700' : ''}`}>
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td>{t.phone}</td>
                    <td>{t.rooms?.room_number || 'N/A'}</td>
                    <td>{t.properties?.name || 'N/A'}</td>
                    <td>{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between p-4">
              <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} className="px-3 py-1 bg-gray-300 rounded">Prev</button>
              <span>Page {currentPage} of {Math.ceil(filteredTenants.length/itemsPerPage)}</span>
              <button onClick={() => setCurrentPage(p => p+1)} disabled={currentPage>=Math.ceil(filteredTenants.length/itemsPerPage)} className="px-3 py-1 bg-gray-300 rounded">Next</button>
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className={`rounded-2xl shadow-lg overflow-x-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <table className="w-full">
              <thead className={`border-b ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr><th>Date</th><th>Tenant</th><th>Amount</th><th>Method</th><th>Status</th></tr>
              </thead>
              <tbody>
                {paginate(filteredPayments).map(p => (
                  <tr key={p.id} className={`border-b ${darkMode ? 'border-gray-700' : ''}`}>
                    <td className="px-4 py-3">{formatDate(p.payment_date)}</td>
                    <td>{p.tenants?.name}</td>
                    <td className="text-green-600 font-semibold">{formatCurrency(p.amount)}</td>
                    <td className="capitalize">{p.payment_method}</td>
                    <td><span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between p-4">{/* pagination same as above */}</div>
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div className={`rounded-2xl shadow-lg overflow-x-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <table className="w-full">
              <thead className={`border-b ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr><th>Room No.</th><th>Property</th><th>Sharing</th><th>Rent (₹)</th><th>Occupancy</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {rooms.map(room => (
                  <tr key={room.id} className={`border-b ${darkMode ? 'border-gray-700' : ''}`}>
                    <td className="px-4 py-3 font-medium">{room.room_number}</td>
                    <td>{room.properties?.name}</td>
                    <td>{room.sharing_type}</td>
                    <td>{formatCurrency(room.monthly_rent)}</td>
                    <td>{room.current_occupants}/{room.capacity}</td>
                    <td><button onClick={() => setDeleteConfirmModal({ show: true, type: 'room', id: room.id, name: `Room ${room.room_number}` })} className="text-red-500 text-sm">Delete</button></td>
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
              <div key={b.id} className={`rounded-xl border p-4 flex justify-between items-start ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
                <div>
                  <p className="font-semibold">{b.name}</p>
                  <p className="text-sm text-gray-500">📞 {b.phone}</p>
                  <p className="text-sm">Room {b.rooms?.room_number} - {b.properties?.name}</p>
                  <p className="text-xs text-gray-400">Expected move‑in: {formatDate(b.expected_move_in_date)}</p>
                  {b.payment_screenshot && <a href={b.payment_screenshot} target="_blank" className="text-blue-500 text-xs">View Screenshot</a>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approvePreBooking(b.id, b.room_id, b.user_id)} className="bg-green-600 text-white px-3 py-1 rounded text-xs">Approve</button>
                  <button onClick={() => rejectPreBooking(b.id)} className="bg-red-500 text-white px-3 py-1 rounded text-xs">Reject</button>
                </div>
              </div>
            ))}
            {preBookings.length === 0 && <p className="text-center text-gray-500">No pre‑bookings</p>}
          </div>
        )}

        {/* Applications Tab */}
        {activeTab === 'applications' && (
          <div className="space-y-4">
            {applications.map(app => (
              <div key={app.id} className={`rounded-xl border p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
                <p className="font-semibold">{app.name}</p>
                <p className="text-sm">📞 {app.phone}</p>
                <p className="text-xs text-gray-400">Applied: {formatDate(app.created_at)}</p>
                {app.id_proof && <a href={app.id_proof} target="_blank" className="text-blue-500 text-xs">View ID</a>}
              </div>
            ))}
            {applications.length === 0 && <p className="text-center text-gray-500">No pending applications</p>}
          </div>
        )}

        {/* Complaints Tab – with delete */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            {complaints.map(c => (
              <div key={c.id} className={`rounded-xl border p-4 flex justify-between items-start ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
                <div>
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-sm text-gray-500">From: {c.tenants?.name || c.tenant_name}</p>
                  <p className="text-sm">{c.description}</p>
                  <span className={`px-2 py-1 rounded-full text-xs ${c.status === 'open' ? 'bg-red-100 text-red-700' : c.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{c.status}</span>
                </div>
                <button onClick={() => deleteComplaint(c.id)} className="text-red-500 text-sm">Delete</button>
              </div>
            ))}
          </div>
        )}

        {/* Vacate Tab */}
        {activeTab === 'vacate' && (
          <div className="space-y-4">
            {vacateRequests.map(v => (
              <div key={v.id} className={`rounded-xl border p-4 flex justify-between items-center ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
                <div>
                  <p className="font-semibold">{v.tenants?.name || v.tenant_name}</p>
                  <p className="text-sm">Room {v.rooms?.room_number || v.room_number}</p>
                  <p className="text-sm">Expected: {formatDate(v.expected_check_out)}</p>
                </div>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">{v.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Notices Tab */}
        {activeTab === 'notices' && (
          <div className="space-y-4">
            <button onClick={() => {
              const propertyId = prompt('Property ID:')
              const title = prompt('Title:')
              const content = prompt('Content:')
              const type = prompt('Type (general/maintenance/payment/event/emergency):')
              const isUrgent = confirm('Is urgent?')
              if (propertyId && title && content) postNotice(propertyId, title, content, type, isUrgent)
            }} className="bg-purple-600 text-white px-4 py-2 rounded-lg mb-4">+ Post Notice</button>
            {notices.map(n => (
              <div key={n.id} className={`rounded-xl border p-4 flex justify-between items-start ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
                <div>
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-sm text-gray-500">{n.properties?.name} • {n.type}</p>
                  <p className="text-sm">{n.content}</p>
                  <p className="text-xs text-gray-400">{formatDate(n.created_at)}</p>
                </div>
                <button onClick={() => deleteNotice(n.id)} className="text-red-500 text-sm">Delete</button>
              </div>
            ))}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className={`rounded-2xl shadow-lg overflow-x-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <table className="w-full">
              <thead className={`border-b ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={`border-b ${darkMode ? 'border-gray-700' : ''}`}>
                    <td className="px-4 py-3">{u.full_name}</td>
                    <td>{u.email}</td>
                    <td>{u.phone}</td>
                    <td>
                      <select value={u.role} onChange={e => updateUserRole(u.id, e.target.value)} className={`text-xs border rounded px-1 ${darkMode ? 'bg-gray-700' : 'bg-white'}`}>
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                        <option value="tenant">Tenant</option>
                      </select>
                    </td>
                    <td className="flex gap-2">
                      <button onClick={() => setDeleteConfirmModal({ show: true, type: 'user', id: u.id, name: u.full_name })} className="text-red-500 text-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Owner Settings Tab */}
        {activeTab === 'owner-settings' && (
          <div className={`rounded-2xl shadow-lg overflow-x-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <table className="w-full">
              <thead className={`border-b ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr><th>Owner</th><th>UPI ID</th><th>UPI Phone</th><th>Joining Fee</th><th>Advance Months</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {ownerSettings.map(os => (
                  <tr key={os.owner_id} className={`border-b ${darkMode ? 'border-gray-700' : ''}`}>
                    <td className="px-4 py-3">{os.users?.full_name}</td>
                    <td>{os.upi_id || '—'}</td>
                    <td>{os.upi_phone || '—'}</td>
                    <td>{formatCurrency(os.joining_fee || 0)}</td>
                    <td>{os.advance_months || 1}</td>
                    <td><button onClick={() => setEditOwnerSettingsModal({ show: true, settings: os })} className="text-blue-500 text-sm">Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* System Settings Tab */}
        {activeTab === 'system-settings' && (
          <div className={`rounded-2xl p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-xl font-bold mb-4">⚙️ Global System Settings</h2>
            <div className="space-y-4">
              <div><label>Pre‑booking Fee (₹)</label><input type="number" className={`w-full p-2 border rounded ${darkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`} value={systemSettings.pre_booking_fee} onChange={e => setSystemSettings({...systemSettings, pre_booking_fee: parseInt(e.target.value)})} /></div>
              <div><label>Max Advance Months (for new tenants)</label><input type="number" className="w-full p-2 border rounded" value={systemSettings.max_advance_months} onChange={e => setSystemSettings({...systemSettings, max_advance_months: parseInt(e.target.value)})} /></div>
              <div><label>Due Alert Threshold (days)</label><input type="number" className="w-full p-2 border rounded" value={systemSettings.due_alert_days} onChange={e => setSystemSettings({...systemSettings, due_alert_days: parseInt(e.target.value)})} /></div>
              <button onClick={updateSystemSettings} className="bg-purple-600 text-white px-6 py-2 rounded-lg">Save Settings</button>
            </div>
          </div>
        )}

        {/* Membership Plans Tab */}
        {activeTab === 'membership-plans' && (
          <div className="grid md:grid-cols-2 gap-6">
            {membershipPlans.map(plan => (
              <div key={plan.id} className={`rounded-2xl p-6 shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h2 className="text-2xl font-bold">{plan.name}</h2>
                <p className="text-3xl font-bold text-purple-600">₹{plan.price}<span className="text-sm text-gray-500">/{plan.id === 'monthly' ? 'month' : 'year'}</span></p>
                <ul className="mt-4 space-y-1">
                  {plan.features?.map((f, i) => <li key={i}>✓ {f}</li>)}
                </ul>
                <button onClick={() => setEditPlanModal({ show: true, plan })} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg">Edit Plan</button>
              </div>
            ))}
          </div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === 'audit-logs' && (
          <div className={`rounded-2xl shadow-lg overflow-x-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <table className="w-full">
              <thead className={`border-b ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr><th>Time</th><th>Action</th><th>Details</th></tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id} className={`border-b ${darkMode ? 'border-gray-700' : ''}`}>
                    <td className="px-4 py-3 text-sm">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-sm">{log.action}</td>
                    <td className="px-4 py-3 text-sm">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Grant Membership Modal */}
      <AnimatePresence>
        {grantModal.show && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setGrantModal({ show: false, ownerId: null, ownerName: '' })}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Grant Membership</h2>
              <p>Owner: <strong>{grantModal.ownerName}</strong></p>
              <div className="my-4"><label>Duration (days)</label><input type="number" className="w-full p-2 border rounded" value={grantDuration} onChange={e => setGrantDuration(parseInt(e.target.value) || 30)} min={1} /></div>
              <div className="flex gap-3">
                <button onClick={() => handleMembershipAction(grantModal.ownerId, 'grant', grantDuration)} disabled={grantSubmitting} className="flex-1 bg-purple-600 text-white py-2 rounded-lg">Grant</button>
                <button onClick={() => setGrantModal({ show: false, ownerId: null, ownerName: '' })} className="flex-1 border-2 border-gray-300 py-2 rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Plan Modal */}
      <AnimatePresence>
        {editPlanModal.show && editPlanModal.plan && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditPlanModal({ show: false, plan: null })}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Edit {editPlanModal.plan.name}</h2>
              <div><label>Price (₹)</label><input type="number" className="w-full p-2 border rounded" value={editPlanModal.plan.price} onChange={e => setEditPlanModal({...editPlanModal, plan: {...editPlanModal.plan, price: parseInt(e.target.value)}})} /></div>
              <div><label>Features (comma separated)</label><input type="text" className="w-full p-2 border rounded" value={editPlanModal.plan.features?.join(', ')} onChange={e => setEditPlanModal({...editPlanModal, plan: {...editPlanModal.plan, features: e.target.value.split(',').map(f=>f.trim())}})} /></div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => updateMembershipPlan(editPlanModal.plan)} className="bg-purple-600 text-white px-4 py-2 rounded-lg">Save</button>
                <button onClick={() => setEditPlanModal({ show: false, plan: null })} className="border-2 border-gray-300 px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Owner Settings Modal */}
      <AnimatePresence>
        {editOwnerSettingsModal.show && editOwnerSettingsModal.settings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4">Edit Owner Settings</h2>
              <div><label>UPI ID</label><input type="text" className="w-full p-2 border rounded" value={editOwnerSettingsModal.settings.upi_id || ''} onChange={e => setEditOwnerSettingsModal({...editOwnerSettingsModal, settings: {...editOwnerSettingsModal.settings, upi_id: e.target.value}})} /></div>
              <div><label>UPI Phone</label><input type="text" className="w-full p-2 border rounded" value={editOwnerSettingsModal.settings.upi_phone || ''} onChange={e => setEditOwnerSettingsModal({...editOwnerSettingsModal, settings: {...editOwnerSettingsModal.settings, upi_phone: e.target.value}})} /></div>
              <div><label>Joining Fee (₹)</label><input type="number" className="w-full p-2 border rounded" value={editOwnerSettingsModal.settings.joining_fee || 0} onChange={e => setEditOwnerSettingsModal({...editOwnerSettingsModal, settings: {...editOwnerSettingsModal.settings, joining_fee: parseInt(e.target.value)}})} /></div>
              <div><label>Advance Months</label><input type="number" className="w-full p-2 border rounded" value={editOwnerSettingsModal.settings.advance_months || 1} onChange={e => setEditOwnerSettingsModal({...editOwnerSettingsModal, settings: {...editOwnerSettingsModal.settings, advance_months: parseInt(e.target.value)}})} /></div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => updateOwnerSettings(editOwnerSettingsModal.settings.owner_id, editOwnerSettingsModal.settings)} className="bg-purple-600 text-white px-4 py-2 rounded-lg">Save</button>
                <button onClick={() => setEditOwnerSettingsModal({ show: false, settings: null })} className="border-2 border-gray-300 px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmModal.show && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirmModal({ show: false, type: '', id: null, name: '' })}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4 text-red-600">Confirm Deletion</h2>
              <p>Are you sure you want to delete <strong>{deleteConfirmModal.name}</strong>? This action cannot be undone.</p>
              <div className="flex gap-3 mt-6">
                <button onClick={() => {
                  if (deleteConfirmModal.type === 'property') deleteProperty(deleteConfirmModal.id)
                  else if (deleteConfirmModal.type === 'user') deleteUser(deleteConfirmModal.id)
                  else setDeleteConfirmModal({ show: false, type: '', id: null, name: '' })
                }} className="bg-red-600 text-white px-4 py-2 rounded-lg">Delete</button>
                <button onClick={() => setDeleteConfirmModal({ show: false, type: '', id: null, name: '' })} className="border-2 border-gray-300 px-4 py-2 rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
