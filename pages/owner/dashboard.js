import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

export default function OwnerDashboard() {
  const router = useRouter()
  const [tenants, setTenants] = useState([
    { id: 1, name: 'Rahul Sharma', phone: '9876543210', room: '204', rent: 12000, status: 'Due', moveIn: '2024-01-15' },
    { id: 2, name: 'Priya Patel', phone: '9876543211', room: '101', rent: 10000, status: 'Paid', moveIn: '2024-02-01' },
    { id: 3, name: 'Amit Kumar', phone: '9876543212', room: '305', rent: 15000, status: 'Paid', moveIn: '2024-01-10' },
  ])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRentModal, setShowRentModal] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [activeTab, setActiveTab] = useState('tenants')
  const [formData, setFormData] = useState({ name: '', phone: '', room: '', rent: '' })

  const stats = {
    totalRooms: 24,
    occupied: 18,
    vacant: 6,
    dueAmount: tenants.filter(t => t.status === 'Due').reduce((sum, t) => sum + t.rent, 0),
    monthlyRevenue: tenants.filter(t => t.status === 'Paid').reduce((sum, t) => sum + t.rent, 0),
  }

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn) {
      router.push('/login')
    }
  }, [])

  const addTenant = () => {
    if (!formData.name || !formData.phone || !formData.room || !formData.rent) {
      alert('Please fill all fields')
      return
    }
    const newTenant = {
      id: Date.now(),
      name: formData.name,
      phone: formData.phone,
      room: formData.room,
      rent: parseInt(formData.rent),
      status: 'Due',
      moveIn: new Date().toISOString().split('T')[0],
    }
    setTenants([...tenants, newTenant])
    setShowAddModal(false)
    setFormData({ name: '', phone: '', room: '', rent: '' })
    alert('Tenant added successfully!')
  }

  const markRentPaid = () => {
    const updatedTenants = tenants.map(t =>
      t.id === selectedTenant.id ? { ...t, status: 'Paid' } : t
    )
    setTenants(updatedTenants)
    setShowRentModal(false)
    alert(`Rent marked as paid for ${selectedTenant.name}`)
  }

  const deleteTenant = (id) => {
    if (confirm('Are you sure you want to remove this tenant?')) {
      setTenants(tenants.filter(t => t.id !== id))
      alert('Tenant removed successfully')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('userRole')
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-primary text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-lg">
        <Link href="/owner/dashboard" className="text-2xl font-bold">🏠 HOSTELSET</Link>
        <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600 transition">
          Logout
        </button>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Owner Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back! Here's your property overview</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-primary">
            <p className="text-gray-500 text-sm">Total Rooms</p>
            <p className="text-3xl font-bold text-primary">{stats.totalRooms}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-green-500">
            <p className="text-gray-500 text-sm">Occupied</p>
            <p className="text-3xl font-bold text-green-600">{stats.occupied}</p>
            <p className="text-xs text-gray-400 mt-1">{Math.round((stats.occupied/stats.totalRooms)*100)}% occupancy</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-orange-500">
            <p className="text-gray-500 text-sm">Vacant</p>
            <p className="text-3xl font-bold text-orange-500">{stats.vacant}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-red-500">
            <p className="text-gray-500 text-sm">Due Today</p>
            <p className="text-3xl font-bold text-red-600">₹{stats.dueAmount.toLocaleString()}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button onClick={() => setShowAddModal(true)} className="bg-primary text-white p-4 rounded-xl font-semibold hover:bg-opacity-90 transition transform hover:scale-105">
            + Add Tenant
          </button>
          <button className="bg-secondary text-white p-4 rounded-xl font-semibold hover:bg-opacity-90 transition transform hover:scale-105">
            📢 Post Notice
          </button>
          <button className="bg-green-600 text-white p-4 rounded-xl font-semibold hover:bg-opacity-90 transition transform hover:scale-105">
            💰 Collect Rent
          </button>
          <button className="bg-purple-600 text-white p-4 rounded-xl font-semibold hover:bg-opacity-90 transition transform hover:scale-105">
            📊 Reports
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-6">
          {['tenants', 'rooms', 'payments'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold capitalize transition ${
                activeTab === tab
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tenants Table */}
        {activeTab === 'tenants' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">📋 All Tenants</h2>
              <button onClick={() => setShowAddModal(true)} className="text-primary text-sm font-semibold">+ Add New</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Phone</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Room</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Rent</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="border-b hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-medium text-gray-800">{tenant.name}</td>
                      <td className="px-6 py-4 text-gray-600">{tenant.phone}</td>
                      <td className="px-6 py-4 text-gray-600">Room {tenant.room}</td>
                      <td className="px-6 py-4 font-semibold text-gray-800">₹{tenant.rent.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          tenant.status === 'Due' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {tenant.status === 'Due' ? '⚠️ Due' : '✅ Paid'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {tenant.status === 'Due' && (
                          <button
                            onClick={() => { setSelectedTenant(tenant); setShowRentModal(true) }}
                            className="text-green-600 hover:text-green-800 font-medium mr-4 transition"
                          >
                            Mark Paid
                          </button>
                        )}
                        <button
                          onClick={() => deleteTenant(tenant.id)}
                          className="text-red-600 hover:text-red-800 font-medium transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tenants.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  No tenants yet. Click "Add Tenant" to get started.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[101, 102, 103, 104, 105, 106, 201, 202, 203, 204, 205, 206].map((room) => (
                <div key={room} className={`border rounded-xl p-4 text-center hover:shadow-md transition cursor-pointer ${
                  room <= 204 ? 'bg-green-50 border-green-200' : 'bg-white'
                }`}>
                  <p className="font-bold text-lg">Room {room}</p>
                  <p className={`text-sm mt-2 font-semibold ${room <= 204 ? 'text-green-600' : 'text-orange-500'}`}>
                    {room <= 204 ? '👤 Occupied' : '🔓 Vacant'}
                  </p>
                  {room <= 204 && <p className="text-xs text-gray-500 mt-1">₹12,000/month</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">Payment Summary</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-green-600 text-sm">Total Collected</p>
                <p className="text-2xl font-bold text-green-700">₹{stats.monthlyRevenue.toLocaleString()}</p>
                <p className="text-xs text-green-500 mt-1">This month</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-red-600 text-sm">Pending Collection</p>
                <p className="text-2xl font-bold text-red-700">₹{stats.dueAmount.toLocaleString()}</p>
                <p className="text-xs text-red-500 mt-1">From {tenants.filter(t => t.status === 'Due').length} tenants</p>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="font-semibold mb-3">Recent Transactions</h3>
              <div className="space-y-2">
                {tenants.filter(t => t.status === 'Paid').map((tenant) => (
                  <div key={tenant.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div><p className="font-medium">{tenant.name}</p><p className="text-xs text-gray-500">Room {tenant.room}</p></div>
                    <div className="text-right"><p className="font-bold text-green-600">₹{tenant.rent.toLocaleString()}</p><p className="text-xs text-gray-400">Paid</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Tenant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Add New Tenant</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Full Name"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
              <input
                type="tel"
                placeholder="Phone Number"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
              <input
                type="text"
                placeholder="Room Number"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                value={formData.room}
                onChange={(e) => setFormData({...formData, room: e.target.value})}
              />
              <input
                type="number"
                placeholder="Monthly Rent (₹)"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                value={formData.rent}
                onChange={(e) => setFormData({...formData, rent: e.target.value})}
              />
              <div className="flex gap-3 mt-6">
                <button onClick={addTenant} className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold">Add Tenant</button>
                <button onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mark Rent Paid Modal */}
      {showRentModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center shadow-2xl">
            <div className="text-5xl mb-4">💰</div>
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Confirm Rent Payment</h2>
            <p className="text-gray-600 mb-2">Mark rent as paid for <strong className="text-primary">{selectedTenant.name}</strong></p>
            <p className="text-xl font-bold text-primary mb-6">₹{selectedTenant.rent.toLocaleString()}</p>
            <div className="flex gap-3">
              <button onClick={markRentPaid} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold">Confirm Payment</button>
              <button onClick={() => setShowRentModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
