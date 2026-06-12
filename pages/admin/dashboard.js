import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate } from '../../lib/utils'
import toast from 'react-hot-toast'
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
  const [stats, setStats] = useState({
    totalProperties: 0,
    totalTenants: 0,
    totalRevenue: 0,
    occupancyRate: 0,
  })
  const [revenueData, setRevenueData] = useState([])
  const [occupancyData, setOccupancyData] = useState([])
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const userRole = localStorage.getItem('userRole')
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn || userRole !== 'admin') {
      router.push('/login')
      return
    }
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    try {
      // Fetch all properties with owner info (join via users table)
      const { data: props } = await supabase.from('properties').select('*, users!properties_owner_id_fkey(full_name, email, phone)')
      setProperties(props || [])

      // Tenants
      const { data: tnts } = await supabase.from('tenants').select('*, rooms(room_number, sharing_type), properties(name)')
      setTenants(tnts || [])

      // Payments (last 100)
      const { data: pms } = await supabase.from('payment_history').select('*, tenants(name)').order('payment_date', { ascending: false }).limit(100)
      setPayments(pms || [])

      // Complaints
      const { data: cmps } = await supabase.from('complaints').select('*, tenants(name)').order('created_at', { ascending: false }).limit(50)
      setComplaints(cmps || [])

      // Vacate requests
      const { data: vacates } = await supabase.from('check_out_requests').select('*, tenants(name), rooms(room_number)').order('created_at', { ascending: false }).limit(50)
      setVacateRequests(vacates || [])

      // Calculate stats
      const totalProperties = props?.length || 0
      const totalTenants = tnts?.length || 0
      const totalRevenue = pms?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
      const occupiedRooms = (await supabase.from('rooms').select('*', { count: 'exact' }).filter('current_occupants', 'gt', 0)).count || 0
      const totalRooms = (await supabase.from('rooms').select('*', { count: 'exact' })).count || 0
      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

      setStats({ totalProperties, totalTenants, totalRevenue, occupancyRate })
      setOccupancyData([
        { name: 'Occupied', value: occupiedRooms },
        { name: 'Vacant', value: totalRooms - occupiedRooms },
      ])

      // Monthly revenue data (last 6 months)
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
        if (key in monthlyRevenue) {
          monthlyRevenue[key] += p.amount
        }
      })
      setRevenueData(Object.entries(monthlyRevenue).map(([month, amount]) => ({
        month,
        revenue: amount,
      })))

    } catch (error) {
      console.error('Admin load error:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const grantFreeMembership = async (ownerId) => {
    const ok = confirm('Grant free 12‑month membership to this owner?')
    if (!ok) return
    const res = await fetch('/api/admin/grant-membership', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId }),
    })
    const data = await res.json()
    if (data.success) {
      toast.success('Free membership granted!')
      loadAllData() // refresh
    } else {
      toast.error(data.error || 'Failed')
    }
  }

  const handleLogout = () => {
    localStorage.clear()
    router.push('/')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    </div>
  )

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
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm"><p className="text-gray-500 text-sm">Properties</p><p className="text-2xl font-bold text-slate-800">{stats.totalProperties}</p></div>
          <div className="bg-white rounded-xl p-5 shadow-sm"><p className="text-gray-500 text-sm">Tenants</p><p className="text-2xl font-bold text-slate-800">{stats.totalTenants}</p></div>
          <div className="bg-white rounded-xl p-5 shadow-sm"><p className="text-gray-500 text-sm">Revenue (₹)</p><p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</p></div>
          <div className="bg-white rounded-xl p-5 shadow-sm"><p className="text-gray-500 text-sm">Occupancy</p><p className="text-2xl font-bold text-blue-600">{stats.occupancyRate}%</p></div>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
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
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm">
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
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-6">
          {['overview', 'properties', 'tenants', 'payments', 'complaints', 'vacate'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                activeTab === tab ? 'bg-slate-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold text-slate-800 mb-4">Recent Activity</h2>
            <div className="space-y-4">
              <p className="text-gray-500">Use the tabs to manage properties, tenants, and memberships.</p>
            </div>
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
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.users?.full_name || 'N/A'}<br/><span className="text-xs">{p.users?.email}</span></td>
                    <td className="px-4 py-3 text-gray-500">{p.city}</td>
                    <td className="px-4 py-3">
                      {p.membership_active ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Active</span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => grantFreeMembership(p.owner_id)}
                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
                      >
                        Grant Free Access
                      </button>
                    </td>
                  </tr>
                ))}
                {properties.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-500">No properties yet</td></tr>}
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
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-gray-500">{t.phone}</td>
                    <td className="px-4 py-3">{t.rooms?.room_number || 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-500">{t.properties?.name || 'N/A'}</td>
                    <td className="px-4 py-3">{t.status}</td>
                  </tr>
                ))}
                {tenants.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-500">No tenants yet</td></tr>}
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
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{formatDate(p.payment_date)}</td>
                    <td className="px-4 py-3 font-medium">{p.tenants?.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-green-600 font-semibold">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{p.payment_method}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">{p.status}</span></td>
                  </tr>
                ))}
                {payments.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-500">No payments yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'complaints' && (
          <div className="bg-white rounded-xl shadow-sm space-y-4 p-4">
            {complaints.map(c => (
              <div key={c.id} className="border rounded-lg p-3">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-sm text-gray-500">From: {c.tenants?.name || c.tenant_name}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    c.status === 'open' ? 'bg-red-100 text-red-700' :
                    c.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>{c.status}</span>
                </div>
              </div>
            ))}
            {complaints.length === 0 && <p className="text-center text-gray-500 py-8">No complaints</p>}
          </div>
        )}

        {activeTab === 'vacate' && (
          <div className="bg-white rounded-xl shadow-sm space-y-4 p-4">
            {vacateRequests.map(v => (
              <div key={v.id} className="border rounded-lg p-3">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{v.tenants?.name || v.tenant_name}</p>
                    <p className="text-sm text-gray-500">Room {v.rooms?.room_number || v.room_number}</p>
                    <p className="text-sm">Expected: {formatDate(v.expected_check_out)}</p>
                  </div>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">{v.status}</span>
                </div>
              </div>
            ))}
            {vacateRequests.length === 0 && <p className="text-center text-gray-500 py-8">No vacate requests</p>}
          </div>
        )}
      </div>
    </div>
  )
}
