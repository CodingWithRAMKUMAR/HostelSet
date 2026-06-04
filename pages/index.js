import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { formatCurrency, getPropertyTypeLabel } from '../lib/utils'

export default function Home() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [properties, setProperties] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [cities, setCities] = useState([])

  const { scrollYProgress } = useScroll()
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.8])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    loadData()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: propertiesData } = await supabase
        .from('properties')
        .select('*')
        .eq('is_active', true)
      
      if (propertiesData) {
        setProperties(propertiesData)
        const uniqueCities = [...new Set(propertiesData.map(p => p.city).filter(Boolean))]
        setCities(uniqueCities)
      }

      const { data: roomsData } = await supabase.from('rooms').select('*')
      if (roomsData) setRooms(roomsData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAvailableRoomsCount = (propertyId) => {
    const propertyRooms = rooms.filter(r => r.property_id === propertyId)
    return propertyRooms.filter(r => r.current_occupants < r.capacity).length
  }

  const getPropertyRating = () => (4.5 + Math.random() * 0.5).toFixed(1)

  const filteredProperties = properties.filter(prop => {
    if (selectedCity !== 'all' && prop.city !== selectedCity) return false
    if (selectedType !== 'all' && prop.property_type !== selectedType) return false
    if (searchQuery && !prop.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !prop.city.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

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
              <span className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                HOSTELSET
              </span>
            </Link>
            
            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-gray-600 hover:text-slate-800 transition">Features</Link>
              <Link href="#properties" className="text-gray-600 hover:text-slate-800 transition">Properties</Link>
              <Link href="#how-it-works" className="text-gray-600 hover:text-slate-800 transition">How it Works</Link>
              <Link href="#pricing" className="text-gray-600 hover:text-slate-800 transition">Pricing</Link>
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
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-0 right-0 bg-white shadow-lg z-40 md:hidden"
          >
            <div className="flex flex-col p-6 gap-4">
              <Link href="#features" className="py-2 text-gray-600 hover:text-slate-800" onClick={() => setMobileMenuOpen(false)}>Features</Link>
              <Link href="#properties" className="py-2 text-gray-600 hover:text-slate-800" onClick={() => setMobileMenuOpen(false)}>Properties</Link>
              <Link href="#how-it-works" className="py-2 text-gray-600 hover:text-slate-800" onClick={() => setMobileMenuOpen(false)}>How it Works</Link>
              <Link href="#pricing" className="py-2 text-gray-600 hover:text-slate-800" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
              <Link href="/login" className="py-2 text-slate-800 font-semibold" onClick={() => setMobileMenuOpen(false)}>Login</Link>
              <Link href="/owner/register-property" className="bg-slate-800 text-white px-5 py-2 rounded-full text-center" onClick={() => setMobileMenuOpen(false)}>List Property</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <Link href="#properties" className="border-2 border-slate-300 text-slate-700 px-8 py-3 rounded-full font-semibold hover:border-slate-800 hover:bg-slate-50 transition flex items-center justify-center gap-2">
                  Explore Properties
                </Link>
              </div>
            </motion.div>

            {/* Search Bar */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-2xl shadow-xl p-2 max-w-3xl mx-auto"
            >
              <div className="flex flex-col md:flex-row gap-2">
                <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl">
                  <span className="text-gray-400">🔍</span>
                  <input
                    type="text"
                    placeholder="Search by city, area, or PG name..."
                    className="w-full bg-transparent focus:outline-none text-gray-700"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button className="bg-slate-800 text-white px-6 py-2 rounded-xl font-semibold hover:bg-slate-700 transition">
                  Search
                </button>
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

      {/* Features Section */}
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

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              How <span className="text-slate-600">HOSTELSET</span> Works
            </h2>
            <p className="text-gray-500 text-lg">Get started in three simple steps</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Register Your Property', desc: 'Sign up and list your property details', icon: '📝' },
              { step: '02', title: 'Add Rooms & Tenants', desc: 'Manage rooms, add tenants, set rent amounts', icon: '🏠' },
              { step: '03', title: 'Start Earning', desc: 'Collect rent online, track payments, grow business', icon: '💰' },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2 }}
                viewport={{ once: true }}
                className="relative bg-white rounded-2xl p-8 text-center shadow-sm hover:shadow-xl transition-all duration-300"
              >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-md">
                  <span className="text-xl">{item.icon}</span>
                </div>
                <div className="mt-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-600 rounded-2xl flex items-center justify-center mx-auto text-2xl text-white shadow-md">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">{item.title}</h3>
                <p className="text-gray-500">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Properties Section */}
      <section id="properties" className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-wrap justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">
                Popular <span className="text-slate-600">PGs Near You</span>
              </h2>
              <p className="text-gray-500">Discover the best PG accommodations in your city</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-8">
            <button
              onClick={() => setSelectedCity('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCity === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Cities
            </button>
            {cities.map(city => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCity === city
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {city}
              </button>
            ))}
            <button
              onClick={() => setSelectedType('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedType === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setSelectedType('boys')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedType === 'boys'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              👨 Boys PG
            </button>
            <button
              onClick={() => setSelectedType('girls')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedType === 'girls'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              👩 Girls PG
            </button>
            <button
              onClick={() => setSelectedType('co-ed')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedType === 'co-ed'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              👥 Co-ed PG
            </button>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="spinner"></div>
              <p className="mt-4 text-gray-500">Loading properties...</p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProperties.slice(0, 6).map((property, index) => {
                  const availableRooms = getAvailableRoomsCount(property.id)
                  const rating = getPropertyRating()
                  return (
                    <motion.div
                      key={property.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      viewport={{ once: true }}
                      whileHover={{ y: -8 }}
                      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100"
                    >
                      <div className="relative h-48 bg-gradient-to-br from-slate-100 to-gray-100 overflow-hidden">
                        {property.photos && property.photos[0] ? (
                          <img src={property.photos[0]} alt={property.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-6xl">🏠</div>
                        )}
                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-sm font-semibold text-slate-700">
                          ⭐ {rating}
                        </div>
                        <div className="absolute bottom-3 left-3 bg-slate-800/80 backdrop-blur-sm px-2 py-1 rounded-lg text-xs text-white">
                          {getPropertyTypeLabel(property.property_type)}
                        </div>
                      </div>
                      <div className="p-5">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-xl font-bold text-slate-800">{property.name}</h3>
                        </div>
                        <p className="text-gray-500 text-sm mb-2 flex items-center gap-1">
                          <span>📍</span> {property.city}
                        </p>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {property.amenities?.slice(0, 3).map((a, i) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{a}</span>
                          ))}
                          {property.amenities?.length > 3 && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">+{property.amenities.length - 3}</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <span className="text-2xl font-bold text-slate-800">{formatCurrency(property.min_rent || 8000)}</span>
                            <span className="text-gray-400">/month</span>
                          </div>
                          <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                            {availableRooms} rooms available
                          </span>
                        </div>
                        <Link
                          href={`/property/${property.id}`}
                          className="flex items-center justify-center gap-2 w-full bg-slate-800 text-white py-2.5 rounded-xl font-semibold hover:bg-slate-700 transition group"
                        >
                          View Details
                          <span className="group-hover:translate-x-1 transition">→</span>
                        </Link>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {filteredProperties.length === 0 && (
                <div className="text-center py-20">
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">No properties found</h3>
                  <p className="text-gray-500">Try adjusting your search or filters</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              Simple, Transparent <span className="text-slate-600">Pricing</span>
            </h2>
            <p className="text-gray-500 text-lg">Choose the plan that fits your business needs</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { name: 'Free', price: '₹0', period: 'forever', features: ['Up to 10 rooms', 'Basic management', 'Manual payments', 'Email support'], popular: false },
              { name: 'Starter', price: '₹499', period: '/month', features: ['Up to 30 rooms', 'Online payments', 'Payment reminders', 'Complaint management', 'Email & WhatsApp support'], popular: false },
              { name: 'Pro', price: '₹999', period: '/month', features: ['Up to 100 rooms', 'WhatsApp alerts', 'Analytics dashboard', 'Staff accounts (3)', 'Priority support'], popular: true },
              { name: 'Enterprise', price: 'Custom', period: '', features: ['Unlimited rooms', 'Multiple properties', 'API access', 'Dedicated support', 'Custom branding'], popular: false },
            ].map((plan, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 ${
                  plan.popular ? 'border-2 border-slate-800 shadow-md' : 'border border-gray-100'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-slate-800 mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold text-slate-800">{plan.price}</span>
                    <span className="text-gray-500">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-green-500">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.name === 'Enterprise' ? '/contact' : '/register'}
                  className={`block text-center py-2.5 rounded-xl font-semibold transition ${
                    plan.popular
                      ? 'bg-slate-800 text-white hover:bg-slate-700'
                      : 'border-2 border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {plan.buttonText || (plan.name === 'Enterprise' ? 'Contact Sales' : 'Start Free Trial')}
                </Link>
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
              <Link href="/contact" className="border-2 border-white text-white px-8 py-3 rounded-full font-semibold hover:bg-white/10 transition inline-flex items-center gap-2">
                Contact Sales
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
                <li><Link href="#pricing" className="hover:text-slate-800">Pricing</Link></li>
                <li><Link href="#properties" className="hover:text-slate-800">Properties</Link></li>
                <li><Link href="#" className="hover:text-slate-800">Demo</Link></li>
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
            <p>&copy; 2024 HOSTELSET. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
