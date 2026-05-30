import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function Home() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const features = [
    { icon: '💰', title: 'Easy Rent Collection', desc: 'Automated reminders and online payments', color: 'from-green-500 to-green-600' },
    { icon: '📊', title: 'Smart Analytics', desc: 'Real-time occupancy and revenue tracking', color: 'from-blue-500 to-blue-600' },
    { icon: '🔧', title: 'Maintenance', desc: 'Quick complaint resolution', color: 'from-orange-500 to-orange-600' },
    { icon: '🏠', title: 'Room Management', desc: 'Easy room allocation and tracking', color: 'from-purple-500 to-purple-600' },
    { icon: '👥', title: 'Tenant Portal', desc: 'Dedicated portal for tenants', color: 'from-pink-500 to-pink-600' },
    { icon: '🔒', title: 'Secure', desc: 'Bank-grade security for all data', color: 'from-indigo-500 to-indigo-600' },
  ]

  const stats = [
    { value: '10,000+', label: 'Happy Tenants' },
    { value: '500+', label: 'Properties' },
    { value: '₹50Cr+', label: 'Rent Collected' },
    { value: '99.9%', label: 'Uptime' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Animated Navbar */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled ? 'bg-white shadow-lg py-3' : 'gradient-bg py-5'
        }`}
      >
        <div className="container mx-auto px-4 flex justify-between items-center">
          <motion.h1 
            whileHover={{ scale: 1.05 }}
            className={`text-2xl font-bold ${scrolled ? 'text-primary' : 'text-white'}`}
          >
            🏠 HOSTELSET
          </motion.h1>
          <div className="flex gap-4 items-center">
            <Link href="/login" className={`${scrolled ? 'text-gray-600 hover:text-primary' : 'text-white hover:underline'}`}>
              Login
            </Link>
            <Link href="/register" className={`px-5 py-2 rounded-lg font-semibold transition ${
              scrolled ? 'bg-primary text-white hover:bg-opacity-90' : 'bg-white text-primary hover:bg-gray-100'
            }`}>
              Get Started
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="gradient-bg text-white pt-32 pb-20">
        <div className="container mx-auto px-4 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-7xl font-bold mb-4"
          >
            Find Your Perfect PG
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-xl md:text-2xl mb-8 opacity-90"
          >
            Set Your Hostel, Simplify Life
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Link href="/register" className="bg-white text-primary px-10 py-4 rounded-xl font-bold text-lg inline-block shadow-lg hover:shadow-xl transition transform hover:scale-105">
              Get Started →
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-gray-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="text-4xl font-bold">{stat.value}</div>
                <div className="mt-2 text-gray-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold mb-4">Why Choose HOSTELSET?</h2>
            <p className="text-xl text-gray-600">Everything you need to manage your PG business</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -10 }}
                className="bg-white rounded-2xl shadow-lg p-6 text-center border border-gray-100 hover:shadow-2xl transition-all cursor-pointer"
              >
                <div className={`w-20 h-20 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl shadow-lg`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-gray-500">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="gradient-bg py-20">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-white mb-4">Ready to Transform Your Hostel Business?</h2>
            <p className="text-xl text-white/80 mb-8">Join thousands of successful PG owners using HOSTELSET</p>
            <Link href="/register" className="bg-white text-primary px-10 py-4 rounded-xl font-bold text-lg inline-block shadow-lg hover:shadow-xl transition transform hover:scale-105">
              Start Free Trial →
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-2xl font-bold mb-4">🏠 HOSTELSET</p>
          <p>© 2024 HOSTELSET. All rights reserved.</p>
          <p className="text-gray-400 text-sm mt-2">India's smartest PG & Hostel management platform</p>
        </div>
      </footer>
    </div>
  )
}
