import Link from 'next/link'
import { useState, useEffect } from 'react'

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('isLoggedIn'))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-primary text-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">🏠 HOSTELSET</h1>
        <div className="flex gap-4">
          {isLoggedIn ? (
            <Link href="/owner/dashboard" className="hover:underline">Dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="hover:underline">Login</Link>
              <Link href="/register" className="bg-white text-primary px-4 py-2 rounded-lg">Register</Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-gradient-to-r from-primary to-orange-400 text-white py-20 text-center">
        <h1 className="text-5xl font-bold mb-4">Find Your Perfect PG</h1>
        <p className="text-xl mb-8">Set Your Hostel, Simplify Life</p>
        <Link href="/register" className="bg-white text-primary px-8 py-3 rounded-lg font-semibold inline-block">
          Get Started →
        </Link>
      </div>

      {/* Features */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Why Choose HOSTELSET?</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow text-center">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-xl font-bold mb-2">Easy Rent Collection</h3>
            <p className="text-gray-600">Automated reminders and tracking</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-bold mb-2">Smart Analytics</h3>
            <p className="text-gray-600">Track occupancy and revenue</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow text-center">
            <div className="text-4xl mb-4">🔧</div>
            <h3 className="text-xl font-bold mb-2">Maintenance</h3>
            <p className="text-gray-600">Quick complaint resolution</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 text-center">
        <p>© 2024 HOSTELSET. All rights reserved.</p>
      </footer>
    </div>
  )
}
