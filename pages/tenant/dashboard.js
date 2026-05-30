import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

export default function TenantDashboard() {
  const router = useRouter()
  const [tenant, setTenant] = useState({
    name: 'Rahul Sharma',
    room: '204',
    property: 'Sunshine PG',
    location: 'Koramangala, Bangalore',
    rent: 12000,
    status: 'Paid',
    dueDate: '5th December, 2024',
  })

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    if (!isLoggedIn) {
      router.push('/login')
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('userRole')
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-primary text-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">🏠 HOSTELSET</h1>
        <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600 transition">
          Logout
        </button>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">My Stay</h1>
          <p className="text-gray-500 mt-1">Welcome to your home, {tenant.name}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">🏠 Current Room</h2>
            <p className="text-3xl font-bold text-primary">Room {tenant.room}</p>
            <p className="text-gray-600 mt-2">{tenant.property}</p>
            <p className="text-gray-500 text-sm">{tenant.location}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">💰 Rent Status</h2>
            <p className={`text-3xl font-bold ${tenant.status === 'Paid' ? 'text-green-600' : 'text-red-600'}`}>
              {tenant.status === 'Paid' ? '✅ Paid' : '⚠️ Due'}
            </p>
            <p className="text-gray-600 mt-2">Amount: ₹{tenant.rent.toLocaleString()}/month</p>
            <p className="text-gray-500 text-sm">Next due date: {tenant.dueDate}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <button className="bg-primary text-white p-4 rounded-xl font-semibold hover:bg-opacity-90 transition transform hover:scale-105">
            💰 Pay Rent
          </button>
          <button className="bg-secondary text-white p-4 rounded-xl font-semibold hover:bg-opacity-90 transition transform hover:scale-105">
            🔧 Raise Complaint
          </button>
          <button className="bg-green-600 text-white p-4 rounded-xl font-semibold hover:bg-opacity-90 transition transform hover:scale-105">
            📢 View Notices
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">📢 Recent Notices</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div><p className="font-semibold">Maintenance Work</p><p className="text-sm text-gray-500">Water supply will be closed on Sunday 10 AM - 2 PM</p></div>
                <span className="text-xs text-gray-400">2 days ago</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div><p className="font-semibold">Diwali Celebration</p><p className="text-sm text-gray-500">Cultural event on 12th Nov at 7 PM in common hall</p></div>
                <span className="text-xs text-gray-400">5 days ago</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">🔧 My Complaints</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div><p className="font-semibold">AC not cooling</p><p className="text-sm text-gray-500">Submitted: 2 days ago</p></div>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">In Progress</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div><p className="font-semibold">Water leakage</p><p className="text-sm text-gray-500">Submitted: 1 week ago</p></div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Resolved</span>
              </div>
            </div>
            <button className="mt-4 text-primary font-semibold hover:underline">+ Raise New Complaint</button>
          </div>
        </div>
      </div>
    </div>
  )
}
