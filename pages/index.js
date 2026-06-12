import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'

export default function Home() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const { scrollYProgress } = useScroll()
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.8])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const features = [
    { icon: '💰', title: 'Easy Rent Collection', desc: 'Auto reminders and online payments', color: 'from-green-500 to-emerald-600' },
    { icon: '🔒', title: 'Secure & Safe', desc: 'Bank-grade security for all data', color: 'from-blue-500 to-indigo-600' },
    { icon: '⏰', title: 'Real-time Updates', desc: 'Instant notifications and tracking', color: 'from-orange-500 to-red-600' },
    { icon: '👥', title: 'Tenant Management', desc: 'Easy onboarding and tracking', color: 'from-purple-500 to-pink-600' },
    { icon: '🏢', title: 'Multi-Property', desc: 'Manage multiple properties', color: 'from-cyan-500 to-blue-600' },
    { icon: '⭐', title: '24/7 Support', desc: 'Dedicated support team', color: 'from-yellow-500 to-orange-600' },
  ]

  const stats = [
    { value: '10,000+', label: 'Happy Tenants', icon: '👥', delay: 0 },
    { value: '500+', label: 'Properties', icon: '🏢', delay: 0.1 },
    { value: '₹50Cr+', label: 'Rent Collected', icon: '💰', delay: 0.2 },
    { value: '99.9%', label: 'Uptime', icon: '🔒', delay: 0.3 },
  ]

  const steps = [
    { number: '01', title: 'Register Your Property', desc: 'Sign up and list your property details in minutes', icon: '📝', color: 'from-blue-500 to-cyan-500' },
    { number: '02', title: 'Add Rooms & Tenants', desc: 'Manage rooms, add tenants, set rent amounts easily', icon: '🏠', color: 'from-purple-500 to-pink-500' },
    { number: '03', title: 'Start Earning', desc: 'Collect rent online, track payments, grow business', icon: '💰', color: 'from-green-500 to-emerald-500' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50">
      {/* MODERN NAVBAR - FIXED ROUTING */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        scrolled 
          ? 'bg-white/90 backdrop-blur-xl shadow-lg py-3' 
          : 'bg-transparent py-6'
      }`}>
        <div className="container mx-auto px-4 md:px-8">
          <div className="flex justify-between items-center">
            {/* Logo - Stays on home page */}
            <Link href="/" className="flex items-center gap-3 group">
              <motion.div 
                whileHover={{ rotate: 360, scale: 1.1 }}
                transition={{ duration: 0.5 }}
                className="text-3xl"
              >
                🏠
              </motion.div>
              <span className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                HOSTELSET
              </span>
            </Link>
            
            {/* DESKTOP NAVIGATION - UPDATED WITH BROWSE PROPERTIES */}
            <div className="hidden md:flex items-center gap-4">
              {/* Browse Properties Link */}
              <Link 
                href="/properties" 
                className="px-5 py-2.5 rounded-full border-2 border-slate-300 text-slate-700 font-semibold hover:border-slate-800 hover:bg-slate-50 transition-all duration-300 flex items-center gap-2"
              >
                <span>🔍</span>
                Browse Properties
              </Link>
              
              {/* Login Button - Outline Style */}
              <Link 
                href="/login" 
                className="px-5 py-2.5 rounded-full border-2 border-slate-300 text-slate-700 font-semibold hover:border-slate-800 hover:bg-slate-50 transition-all duration-300 flex items-center gap-2"
              >
                <span>👤</span>
                Login
              </Link>
              
              {/* List Property Button - Solid Gradient */}
              <Link 
                href="/owner/register-property" 
                className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
              >
                <span>✨</span>
                List Property
              </Link>
            </div>
            
            {/* Mobile Menu Button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="md:hidden p-3 rounded-full bg-white/80 backdrop-blur-sm shadow-sm"
            >
              <span className="text-2xl">{mobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* MOBILE MENU - UPDATED WITH BROWSE PROPERTIES */}
      {mobileMenuOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-4 right-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl z-40 md:hidden border border-gray-100"
        >
          <div className="p-4">
            {/* Browse Properties */}
            <Link 
              href="/properties" 
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-slate-300 text-slate-700 font-semibold hover:bg-gray-50 transition-all duration-300 mb-3"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>🔍</span>
              Browse Properties
            </Link>
            
            <Link 
              href="/login" 
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-slate-300 text-slate-700 font-semibold hover:bg-gray-50 transition-all duration-300 mb-3"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>👤</span>
              Login
            </Link>
            
            <Link 
              href="/owner/register-property" 
              className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-slate-800 to-slate-700 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>✨</span>
              List Property
            </Link>
          </div>
        </motion.div>
      )}

      {/* Hero Section - Modern Design */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-gray-100" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-500" />
        </div>

        <div className="relative container mx-auto px-4 md:px-8 pt-32 pb-20">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-full px-5 py-2.5 mb-8 shadow-sm border border-gray-200"
              >
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-sm font-medium text-gray-700">🚀 Trusted by 500+ Property Owners</span>
              </motion.div>
              
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight">
                <span className="bg-gradient-to-r from-slate-900 via-slate-700 to-slate-600 bg-clip-text text-transparent">
                  Find Your
                </span>
                <br />
                <span className="bg-gradient-to-r from-slate-800 to-slate-500 bg-clip-text text-transparent">
                  Perfect PG
                </span>
              </h1>
              
              <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
                Set Your Hostel, Simplify Life. India's most trusted platform for PG and hostel management with modern tools and real-time insights.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-5 justify-center mb-16">
                <Link 
                  href="/register" 
                  className="group relative bg-gradient-to-r from-slate-800 to-slate-700 text-white px-10 py-4 rounded-full font-semibold hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Get Started Free
                    <span className="group-hover:translate-x-1 transition">→</span>
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-700 to-slate-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </Link>
                <Link 
                  href="/owner/register-property" 
                  className="border-2 border-gray-300 text-gray-700 px-10 py-4 rounded-full font-semibold hover:border-slate-800 hover:bg-white/50 transition-all duration-300 hover:scale-105 backdrop-blur-sm"
                >
                  List Your Property
                </Link>
              </div>
            </motion.div>

            {/* Stats with Modern Cards */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
            >
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: stat.delay + 0.5, type: "spring" }}
                  whileHover={{ y: -5, scale: 1.05 }}
                  className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 text-center border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300"
                >
                  <div className="text-3xl mb-3">{stat.icon}</div>
                  <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
                  <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section with Modern Cards */}
      <section className="py-24 bg-white relative">
        <div className="container mx-auto px-4 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Why Choose{' '}
              <span className="bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                HOSTELSET
              </span>
              ?
            </h2>
            <p className="text-xl text-gray-500">
              Everything you need to manage your PG business efficiently and professionally
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -10, scale: 1.02 }}
                className="group relative bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden"
              >
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${feature.color} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`} />
                <div className="relative">
                  <div className="text-5xl mb-5 group-hover:scale-110 transition-transform duration-300">{feature.icon}</div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">{feature.title}</h3>
                  <p className="text-gray-500 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Modern Timeline */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-white">
        <div className="container mx-auto px-4 md:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              How{' '}
              <span className="bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                HOSTELSET
              </span>{' '}
              Works
            </h2>
            <p className="text-xl text-gray-500">Get started in three simple steps</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting Line - Desktop */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 -translate-y-1/2" />
            
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2 }}
                viewport={{ once: true }}
                whileHover={{ y: -8 }}
                className="relative bg-white rounded-2xl p-8 text-center shadow-lg hover:shadow-2xl transition-all duration-300 z-10"
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                  <div className={`w-14 h-14 bg-gradient-to-r ${step.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                    <span className="text-2xl text-white">{step.icon}</span>
                  </div>
                </div>
                <div className="mt-8 mb-4">
                  <div className="text-5xl font-bold bg-gradient-to-r from-gray-300 to-gray-400 bg-clip-text text-transparent">
                    {step.number}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">{step.title}</h3>
                <p className="text-gray-500">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Modern Gradient */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000" />
        </div>
        
        <div className="relative container mx-auto px-4 md:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Transform Your Hostel Business?
            </h2>
            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
              Join thousands of successful PG owners using HOSTELSET to manage their properties efficiently
            </p>
            <div className="flex flex-col sm:flex-row gap-5 justify-center">
              <Link 
                href="/register" 
                className="group bg-white text-slate-800 px-10 py-4 rounded-full font-semibold hover:shadow-2xl transition-all duration-300 hover:scale-105 inline-flex items-center gap-2"
              >
                Start Free Trial
                <span className="group-hover:translate-x-1 transition">→</span>
              </Link>
              <Link 
                href="/owner/register-property" 
                className="border-2 border-white/30 text-white px-10 py-4 rounded-full font-semibold hover:bg-white/10 transition-all duration-300 hover:scale-105 inline-flex items-center gap-2 backdrop-blur-sm"
              >
                List Your Property
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Modern Footer */}
      <footer className="bg-white border-t border-gray-100 py-16">
        <div className="container mx-auto px-4 md:px-8">
          <div className="grid md:grid-cols-4 gap-12">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl">🏠</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  HOSTELSET
                </span>
              </div>
              <p className="text-gray-500 mb-6 leading-relaxed">
                Set Your Hostel, Simplify Life. India's most trusted PG and hostel management platform.
              </p>
              <div className="flex gap-4">
                <a href="#" className="text-gray-400 hover:text-slate-600 transition-all duration-300 hover:scale-110 text-xl">📘</a>
                <a href="#" className="text-gray-400 hover:text-slate-600 transition-all duration-300 hover:scale-110 text-xl">🐦</a>
                <a href="#" className="text-gray-400 hover:text-slate-600 transition-all duration-300 hover:scale-110 text-xl">📷</a>
                <a href="#" className="text-gray-400 hover:text-slate-600 transition-all duration-300 hover:scale-110 text-xl">🔗</a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 mb-6 text-lg">Product</h4>
              <ul className="space-y-3 text-gray-500">
                <li><a href="#" className="hover:text-slate-800 transition">Features</a></li>
                <li><Link href="/owner/register-property" className="hover:text-slate-800 transition">List Property</Link></li>
                <li><Link href="/login" className="hover:text-slate-800 transition">Login</Link></li>
                <li><Link href="/register" className="hover:text-slate-800 transition">Register</Link></li>
                {/* Added Browse Properties in footer */}
                <li><Link href="/properties" className="hover:text-slate-800 transition">Browse Properties</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 mb-6 text-lg">Company</h4>
              <ul className="space-y-3 text-gray-500">
                <li><a href="#" className="hover:text-slate-800 transition">About Us</a></li>
                <li><a href="#" className="hover:text-slate-800 transition">Contact</a></li>
                <li><a href="#" className="hover:text-slate-800 transition">Blog</a></li>
                <li><a href="#" className="hover:text-slate-800 transition">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 mb-6 text-lg">Legal</h4>
              <ul className="space-y-3 text-gray-500">
                <li><a href="#" className="hover:text-slate-800 transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-slate-800 transition">Terms of Service</a></li>
                <li><a href="#" className="hover:text-slate-800 transition">Cookie Policy</a></li>
                <li><a href="#" className="hover:text-slate-800 transition">Refund Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-100 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2026 HOSTELSET. All rights reserved. Made with ❤️ for PG owners</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
