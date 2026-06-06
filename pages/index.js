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
    { icon: '💰', title: 'Easy Rent Collection', desc: 'Auto reminders and online payments' },
    { icon: '🔒', title: 'Secure & Safe', desc: 'Bank-grade security for all data' },
    { icon: '⏰', title: 'Real-time Updates', desc: 'Instant notifications and tracking' },
    { icon: '👥', title: 'Tenant Management', desc: 'Easy onboarding and tracking' },
    { icon: '🏢', title: 'Multi-Property', desc: 'Manage multiple properties' },
    { icon: '⭐', title: '24/7 Support', desc: 'Dedicated support team' },
  ]

  const stats = [
    { value: '10,000+', label: 'Happy Tenants', icon: '👥' },
    { value: '500+', label: 'Properties', icon: '🏢' },
    { value: '₹50Cr+', label: 'Rent Collected', icon: '💰' },
    { value: '99.9%', label: 'Uptime', icon: '🔒' },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled ? 'bg-white shadow-md py-3' : 'bg-white/95 backdrop-blur-sm py-5 border-b border-gray-100'
      }`}>
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-2xl">🏠</span>
              <span className="text-xl font-bold text-slate-800">HOSTELSET</span>
            </Link>
            
            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-gray-600 hover:text-slate-800 transition">Features</Link>
              <Link href="/login" className="text-slate-800 font-semibold hover:text-slate-600 transition">Login</Link>
              <Link href="/owner/register-property" className="bg-slate-800 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-slate-700 transition shadow-sm">
                List Property
              </Link>
            </div>
            
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2">
              <span className="text-2xl">{mobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed top-16 left-0 right-0 bg-white shadow-lg z-40 md:hidden">
          <div className="flex flex-col p-6 gap-4">
            <Link href="#features" className="py-2 text-gray-600 hover:text-slate-800" onClick={() => setMobileMenuOpen(false)}>Features</Link>
            <Link href="/login" className="py-2 text-slate-800 font-semibold" onClick={() => setMobileMenuOpen(false)}>Login</Link>
            <Link href="/owner/register-property" className="bg-slate-800 text-white px-5 py-2 rounded-full text-center" onClick={() => setMobileMenuOpen(false)}>List Property</Link>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-gray-50" />
        <div className="relative container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-sm text-slate-600">Trusted by 500+ Property Owners</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-800 mb-6 leading-tight">
                Find Your{' '}
                <span className="bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Perfect PG
                </span>
              </h1>
              
              <p className="text-xl text-gray-500 mb-8 max-w-2xl mx-auto">
                Set Your Hostel, Simplify Life. India's most trusted platform for PG and hostel management.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Link href="/register" className="bg-slate-800 text-white px-8 py-3 rounded-full font-semibold hover:bg-slate-700 transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 group">
                  Get Started
                  <span className="group-hover:translate-x-1 transition">→</span>
                </Link>
                <Link href="/owner/register-property" className="border-2 border-slate-300 text-slate-700 px-8 py-3 rounded-full font-semibold hover:border-slate-800 hover:bg-slate-50 transition flex items-center justify-center gap-2">
                  List Your Property
                </Link>
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16"
            >
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-2xl mb-2">{stat.icon}</div>
                  <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section - Simplified */}
      <section id="features" className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              Why Choose <span className="text-slate-600">HOSTELSET</span>?
            </h2>
            <p className="text-gray-500 text-lg">
              Everything you need to manage your PG business efficiently and professionally
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -8 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">{feature.title}</h3>
                <p className="text-gray-500">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-slate-800 to-slate-700">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Transform Your Hostel Business?
            </h2>
            <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">
              Join thousands of successful PG owners using HOSTELSET to manage their properties
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register" className="bg-white text-slate-800 px-8 py-3 rounded-full font-semibold hover:bg-gray-100 transition shadow-md hover:shadow-lg inline-flex items-center gap-2 group">
                Start Free Trial
                <span className="group-hover:translate-x-1 transition">→</span>
              </Link>
              <Link href="/owner/register-property" className="border-2 border-white text-white px-8 py-3 rounded-full font-semibold hover:bg-white/10 transition inline-flex items-center gap-2">
                List Your Property
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🏠</span>
                <span className="text-xl font-bold text-slate-800">HOSTELSET</span>
              </div>
              <p className="text-gray-500 text-sm mb-4">
                Set Your Hostel, Simplify Life. India's most trusted PG and hostel management platform.
              </p>
              <div className="flex gap-4">
                <a href="#" className="text-gray-400 hover:text-slate-600 transition">📘</a>
                <a href="#" className="text-gray-400 hover:text-slate-600 transition">🐦</a>
                <a href="#" className="text-gray-400 hover:text-slate-600 transition">📷</a>
                <a href="#" className="text-gray-400 hover:text-slate-600 transition">🔗</a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 mb-4">Product</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li><Link href="#features" className="hover:text-slate-800">Features</Link></li>
                <li><Link href="/owner/register-property" className="hover:text-slate-800">List Property</Link></li>
                <li><Link href="/login" className="hover:text-slate-800">Login</Link></li>
                <li><Link href="/register" className="hover:text-slate-800">Register</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 mb-4">Company</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li><Link href="#" className="hover:text-slate-800">About Us</Link></li>
                <li><Link href="#" className="hover:text-slate-800">Contact</Link></li>
                <li><Link href="#" className="hover:text-slate-800">Blog</Link></li>
                <li><Link href="#" className="hover:text-slate-800">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li><Link href="#" className="hover:text-slate-800">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:text-slate-800">Terms of Service</Link></li>
                <li><Link href="#" className="hover:text-slate-800">Cookie Policy</Link></li>
                <li><Link href="#" className="hover:text-slate-800">Refund Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-100 mt-8 pt-8 text-center text-gray-400 text-sm">
            <p>&copy; 2026 HOSTELSET. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
