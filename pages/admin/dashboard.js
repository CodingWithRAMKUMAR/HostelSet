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
    pendingMemberships: 0,   // owners with membership_active = false
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
    loadAllData() // initial load with loading spinner
    // Start silent background refresh every 30 seconds
    autoRefreshRef.current = setInterval(() => loadAllData(true), 30000)
    return () => clearInterval(autoRefreshRef.current)
  }, [])

  // isSilent = true → don't show loading spinner (background refresh)
  const loadAllData = async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    try {
      // Fetch all data in parallel
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
        supabase.from('payment_history').select('*, tenants(name)').order('payment_date', { ascending: false }).limit(100),
        supabase.from('complaints').select('*, tenants(name)').order('created_at', { ascending: false }).limit(100),
        supabase.from('check_out_requests').select('*, tenants(name), rooms(room_number)').order('created_at', { ascending: false }).limit(100),
        supabase.from('applications').select('*').eq('status', 'pending').order('created_at', { ascending: false })
      ])

      setProperties(props || [])
      setTenants(tnts || [])
      setPayments(pms || [])
      setComplaints(cmps || [])
      setVacateRequests(vacates || [])
      setApplications(apps || [])

      // Calculate stats
      const totalProperties = props?.length || 0
      const totalTenants = tnts?.length || 0
      const totalRevenue = pms?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

      // Occupancy
      const { count: occupiedRooms, error: occErr } = await supabase.from('rooms').select('*', { count: 'exact', head: true }).gt('current_occupants', 0)
      const { count: totalRooms, error: totalErr } = await supabase.from('rooms').select('*', { count: 'exact', head: true })
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

      // Occupancy pie chart data
      setOccupancyData([
        { name: 'Occupied', value: occupiedRooms },
        { name: 'Vacant', value: totalRooms - occupiedRooms },
      ])

      // Monthly revenue for chart (last 6 months)
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

  // Grant or revoke membership via API
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
      loadAllData(true) // silent refresh
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

  // Initial loading spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800">🛡️ Admin Dashboard</h1>
        <div className="flex gap-4 items-center">
          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Admin</span>
          <button onClick={handleLogout} className="text-red-500 hover:text-red-600">Logout</button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Quick Alerts Banner */}
        {(stats.pendingMemberships > 0 || stats.pendingPayments > 0 || stats.pendingApplications > 0 || stats.unresolvedComplaints > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.pendingMemberships > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-800">
                ⭐ {stats.pendingMemberships} owner(s) without membership
              </motion.div>
            )}
            {stats.pendingPayments > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
                💰 {stats.pendingPayments} tenant(s) awaiting payment confirmation
              </motion.div>
            )}
            {stats.pendingApplications > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800">
                📋 {stats.pendingApplications} new application(s)
              </motion.div>
            )}
            {stats.unresolvedComplaints > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-orange-800">
                🔧 {stats.unresolvedComplaints} unresolved complaint(s)
              </motion.div>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition">
            <p className="text-gray-500 text-sm">Properties</p>
            <p className="text-2xl font-bold text-slate-800">{stats.totalProperties}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition">
            <p className="text-gray-500 text-sm">Tenants</p>
            <p className="text-2xl font-bold text-slate-800">{stats.totalTenants}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition">
            <p className="text-gray-500 text-sm">Revenue (₹)</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition">
            <p className="text-gray-500 text-sm">Occupancy</p>
            <p className="text-2xl font-bold text-blue-600">{stats.occupancyRate}%</p>
          </motion.div>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold text-slate-800 mb-4">Monthly Revenue</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold text-slate-800 mb-4">Occupancy</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={occupancyData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {occupancyData.map((entry, idx) => (
                    <Cell key={idx} fill={idx === 0 ? '#3b82f6' : '#e5e7eb'} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-3 mb-6">
          {['overview', 'properties', 'tenants', 'payments', 'complaints', 'applications', 'vacate'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                activeTab === tab ? 'bg-slate-800 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold text-slate-800 mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {stats.pendingMemberships > 0 && <p className="text-yellow-700">⭐ {stats.pendingMemberships} owners need membership</p>}
                {stats.pendingPayments > 0 && <p className="text-red-700">💰 {stats.pendingPayments} pending payment confirmations</p>}
                {stats.pendingApplications > 0 && <p className="text-blue-700">📋 {stats.pendingApplications} new applications</p>}
                {stats.unresolvedComplaints > 0 && <p className="text-orange-700">🔧 {stats.unresolvedComplaints} open complaints</p>}
                {stats.totalProperties === 0 && <p className="text-gray-500">No properties yet. Invite owners to register!</p>}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold text-slate-800 mb-4">Quick Actions</h2>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• Use the <strong>Properties</strong> tab to grant/revoke memberships.</p>
                <p>• Review <strong>Applications</strong> to approve new tenants.</p>
                <p>• Monitor <strong>Payments</strong> for revenue tracking.</p>
                <p>• Manage <strong>Complaints</strong> – you can delete any complaint directly.</p>
              </div>
            </motion.div>
          </div>
        )}

        {activeTab === 'properties' && (
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
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
                          className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                        >
                          Revoke
                        </button>
                      ) : (
                        <button
                          onClick={() => setGrantModal({ show: true, ownerId: p.owner_id, ownerName: p.users?.full_name || 'Owner' })}
                          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
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
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
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
          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
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
              <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl border p-4 flex justify-between items-start">
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
              <motion.div key={app.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl border p-4 flex justify-between items-center">
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
              <motion.div key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl border p-4 flex justify-between items-center">
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
              className="bg-white rounded-2xl max-w-md w-full p-6"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4">Grant Membership</h2>
              <p className="text-gray-600 mb-4">Owner: <strong>{grantModal.ownerName}</strong></p>
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Duration (days)</label>
                <input
                  type="number"
                  className="w-full px-4 py-2 border rounded-lg"
                  value={grantDuration}
                  onChange={e => setGrantDuration(parseInt(e.target.value) || 30)}
                  min={1}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleMembershipAction(grantModal.ownerId, 'grant', grantDuration)}
                  disabled={grantSubmitting}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
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
