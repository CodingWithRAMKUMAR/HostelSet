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
          <h1 className="text-
