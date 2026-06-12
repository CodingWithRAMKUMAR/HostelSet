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
  const [properties, setProperties] = useState([])
  const [tenants, setTenants] = useState([])
  const [payments, setPayments] = useState([])
  const [complaints, setComplaints] = useState([])
  const [vacateRequests, setVacateRequests] = useState([])
  const [applications, setApplications] = useState([])
  const [stats, setStats] = useState({
    totalProperties: 0,
    totalTenants: 0,
    totalRevenue: 0,
    occupancyRate: 0,
    pendingApplications: 0,
    pendingPayments: 0,
    unresolvedComplaints: 0,
    pendingMemberships: 0,
  })
  const [revenueData, setRevenueData] = useState([])
  const [occupancyData, setOccupancyData] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [grantModal, setGrantModal] = useState({ show: false, ownerId: null, ownerName: '' })
  const [grantDuration, setGrantDuration] = useState(30)
  const [grantSubmitting, setGrantSubmitting] = useState(false)
  const autoRefreshRef = useRef(null)

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
        { data: apps }
      ] = await Promise.all([
        supabase.from('properties').select('*, users!properties_owner_id_fkey(full_name, email, phone)'),
        supabase.from('tenants').select('*, rooms(room_number, sharing_type), properties(name)'),
        supabase.from('payment_history').select('*, tenants(name)').eq('status', 'success').order('payment_date', { ascending: false }).limit(500),
        supabase.from('complaints').select('*, tenants(name)').order('created_at', { ascending: false }).limit(200),
        supabase.from('check_out_requests').select('*, tenants(name), rooms(room_number)').order('created_at', { ascending: false }).limit(200),
        supabase.from('applications').select('*').eq('status', 'pending').order('created_at', { ascending: false })
      ])

      setProperties(props || [])
      setTenants(tnts || [])
      setPayments(pms || [])
      setComplaints(cmps || [])
      setVacateRequests(vacates || [])
      setApplications(apps || [])

      // ✅ Revenue = total paid by tenants (advances + rent collections)
      const totalRevenue = tnts?.reduce((sum, t) => sum + (t.total_paid || 0), 0) || 0
      const totalProperties = props?.length || 0
      const totalTenants = tnts?.length || 0

      // Occupancy
      const { count: occupiedRooms } = await supabase.from('rooms').select('*', { count: 'exact', head: true }).gt('current_occupants', 0)
      const { count: totalRooms } = await supabase.from('rooms').select('*', { count: 'exact', head: true })
      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

      const pendingApplications = apps?.length || 0
      const pendingPayments = tnts?.filter(t => t.status === 'payment_pending').length || 0
      const unresolvedComplaints = cmps?.filter(c => c.status === 'open').length || 0
      const pendingMemberships = props?.filter(p => !p.membership_active).length || 0

      setStats({
        totalProperties,
        totalTenants,
        totalRevenue,
        occupancyRate,
        pendingApplications,
        pendingPayments,
        unresolvedComplaints,
        pendingMemberships,
      })

      setOccupancyData([
        { name: 'Occupied', value: occupiedRooms },
        { name: 'Vacant', value: totalRooms - occupiedRooms },
      ])

      // Monthly revenue from payment_history (for chart only)
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
      loadAllData(true)
    } else {
      toast.error(data.error || 'Action failed')
    }
    setGrantSubmitting(false)
    setGrantModal({ show: false, ownerId: null, ownerName: '' })
  }

  const deleteComplaint = async (complaintId) => {
    if (!confirm('Delete this complaint?')) return
    const { error } = await supabase.from('complaints').delete().eq('id', complaintId)
    if (error) toast.error('Failed to delete')
    else {
      toast.success('Complaint deleted')
      loadAllData(true)
    }
  }

  const handleLogout = () => {
    localStorage.clear()
    router.push('/')
  }

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md shadow-sm px-6 py-4 flex justify-between items-center border-b border-gray-200">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">🛡️ Admin Dashboard</h1>
        <div className="flex gap-4 items-center">
          <span className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-xs font-bold shadow">Admin</span>
          <button onClick={handleLogout} className="text-red-500 hover:text-red-700 font-medium">Logout</button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Quick Alerts Banner */}
        {(stats.pendingMemberships > 0 || stats.pendingPayments > 0 || stats.pendingApplications > 0 || stats.unresolvedComplaints > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.pendingMemberships > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-amber-400 to-yellow-500 text-white rounded-xl p-4 shadow-lg">
                ⭐ {stats.pendingMemberships} owner(s) without membership
              </motion.div>
            )}
            {stats.pendingPayments > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl p-4 shadow-lg">
                💰 {stats.pendingPayments} pending payment confirmations
              </motion.div>
            )}
            {stats.pendingApplications > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl p-4 shadow-lg">
                📋 {stats.pendingApplications} new application(s)
              </motion.div>
            )}
            {stats.unresolvedComplaints > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl p-4 shadow-lg">
                🔧 {stats.unresolvedComplaints} unresolved complaint(s)
              </motion.div>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-xl p-5 shadow-lg hover:shadow-2xl transition">
            <p className="text-white/80 text-sm">Properties</p>
            <p className="text-3xl font-bold">{stats.totalProperties}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-pink-600 to-rose-600 text-white rounded-xl p-5 shadow-lg hover:shadow-2xl transition">
            <p className="text-white/80 text-sm">Tenants</p>
            <p className="text-3xl font-bold">{stats.totalTenants}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-emerald-600 to-green-600 text-white rounded-xl p-5 shadow-lg hover:shadow-2xl transition">
            <p className="text-white/80 text-sm">Revenue (₹)</p>
            <p className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-gradient-to-br from-blue-600 to-cyan-600 text-white rounded-xl p-5 shadow-lg hover:shadow-2xl transition">
            <p className="text-white/80 text-sm">Occupancy</p>
            <p className="text-3xl font-bold">{stats.occupancyRate}%</p>
          </motion.div>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📊 Monthly Revenue</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-800 mb-4">🏠 Occupancy Breakdown</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={occupancyData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {occupancyData.map((entry, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['overview', 'properties', 'tenants', 'payments', 'complaints', 'applications', 'vacate'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold capitalize transition-all ${
                activeTab === tab 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-4">⚡ Recent Activity</h2>
              <div className="space-y-3 text-gray-700">
                {stats.pendingMemberships > 0 && <p className="text-amber-600">⭐ {stats.pendingMemberships} owners need membership</p>}
                {stats.pendingPayments > 0 && <p className="text-red-600">💰 {stats.pendingPayments} pending payment confirmations</p>}
                {stats.pendingApplications > 0 && <p className="text-blue-600">📋 {stats.pendingApplications} new applications</p>}
                {stats.unresolvedComplaints > 0 && <p className="text-orange-600">🔧 {stats.unresolvedComplaints} open complaints</p>}
                {stats.totalProperties === 0 && <p className="text-gray-500">No properties yet. Invite owners to register!</p>}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📌 Quick Actions</h2>
              <div className="space-y-2 text-gray-600">
                <p>• Use the <strong>Properties</strong> tab to grant/revoke memberships.</p>
                <p>• Review <strong>Applications</strong> to approve new tenants.</p>
                <p>• Monitor <strong>Payments</strong> for revenue tracking.</p>
                <p>• Manage <strong>Complaints</strong> – you can delete any complaint directly.</p>
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'properties' && (
          <div className="bg-white rounded-2xl shadow-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Property</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Owner</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">City</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Membership</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map(p => (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {p.users?.full_name || 'N/A'}<br />
                      <span className="text-xs">{p.users?.email}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.city}</td>
                    <td className="px-4 py-3">
                      {p.membership_active ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          Active until {p.membership_expiry ? formatDate(p.membership_expiry) : 'N/A'}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      {p.membership_active ? (
                        <button
                          onClick={() => handleMembershipAction(p.owner_id, 'revoke')}
                          className="text-xs bg-red-500 text-white px-3 py-1 rounded-full hover:bg-red-600 transition"
                        >
                          Revoke
                        </button>
                      ) : (
                        <button
                          onClick={() => setGrantModal({ show: true, ownerId: p.owner_id, ownerName: p.users?.full_name || 'Owner' })}
                          className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1 rounded-full hover:shadow-lg transition"
                        >
                          Grant Access
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'tenants' && (
          <div className="bg-white rounded-2xl shadow-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Room</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Property</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-gray-500">{t.phone}</td>
                    <td className="px-4 py-3">{t.rooms?.room_number || 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-500">{t.properties?.name || 'N/A'}</td>
                    <td className="px-4 py-3">{t.status}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="bg-white rounded-2xl shadow-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Tenant</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Method</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{formatDate(p.payment_date)}</td>
                    <td className="px-4 py-3 font-medium">{p.tenants?.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-green-600 font-semibold">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{p.payment_method}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">{p.status}</span></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'complaints' && (
          <div className="space-y-4">
            {complaints.map(c => (
              <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl border p-4 flex justify-between items-start shadow-sm">
                <div>
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-sm text-gray-500">From: {c.tenants?.name || c.tenant_name}</p>
                  <p className="text-sm">{c.description}</p>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    c.status === 'open' ? 'bg-red-100 text-red-700' :
                    c.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>{c.status}</span>
                </div>
                <button onClick={() => deleteComplaint(c.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
              </motion.div>
            ))}
            {complaints.length === 0 && <p className="text-center text-gray-500 py-8">No complaints</p>}
          </div>
        )}

        {activeTab === 'applications' && (
          <div className="space-y-4">
            {applications.map(app => (
              <motion.div key={app.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl border p-4 flex justify-between items-center shadow-sm">
                <div>
                  <p className="font-semibold">{app.name}</p>
                  <p className="text-sm text-gray-500">📞 {app.phone}</p>
                  {app.message && <p className="text-sm text-gray-600">💬 {app.message}</p>}
                  <p className="text-xs text-gray-400">Applied: {formatDate(app.created_at)}</p>
                </div>
              </motion.div>
            ))}
            {applications.length === 0 && <p className="text-center text-gray-500 py-8">No pending applications</p>}
          </div>
        )}

        {activeTab === 'vacate' && (
          <div className="space-y-4">
            {vacateRequests.map(v => (
              <motion.div key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl border p-4 flex justify-between items-center shadow-sm">
                <div>
                  <p className="font-semibold">{v.tenants?.name || v.tenant_name}</p>
                  <p className="text-sm text-gray-500">Room {v.rooms?.room_number || v.room_number}</p>
                  <p className="text-sm">Expected: {formatDate(v.expected_check_out)}</p>
                </div>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">{v.status}</span>
              </motion.div>
            ))}
            {vacateRequests.length === 0 && <p className="text-center text-gray-500 py-8">No vacate requests</p>}
          </div>
        )}
      </div>

      {/* Grant Membership Modal */}
      <AnimatePresence>
        {grantModal.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setGrantModal({ show: false, ownerId: null, ownerName: '' })}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Grant Membership</h2>
              <p className="text-gray-600 mb-4">Owner: <strong>{grantModal.ownerName}</strong></p>
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Duration (days)</label>
                <input
                  type="number"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  value={grantDuration}
                  onChange={e => setGrantDuration(parseInt(e.target.value) || 30)}
                  min={1}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleMembershipAction(grantModal.ownerId, 'grant', grantDuration)}
                  disabled={grantSubmitting}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
                >
                  {grantSubmitting ? 'Granting...' : 'Grant Access'}
                </button>
                <button
                  onClick={() => setGrantModal({ show: false, ownerId: null, ownerName: '' })}
                  className="flex-1 border-2 border-gray-300 text-gray-700 py-2 rounded-lg font-semibold"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
