import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform, useAnimation, useInView, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/utils'

export default function Home() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [properties, setProperties] = useState([])
  const [stats, setStats] = useState({ properties: 0, rooms: 0, tenants: 0 })
  const [loading, setLoading] = useState(true)
  const [animatedStats, setAnimatedStats] = useState({ properties: 0, rooms: 0, tenants: 0 })
  const [activeTab, setActiveTab] = useState('tenant') // 'tenant' or 'owner'
  const [currentTestimonial, setCurrentTestimonial] = useState(0)

  const { scrollYProgress } = useScroll()
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, 150])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0])

  // Auto-scroll testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Animate stats on load
  useEffect(() => {
    if (stats.properties > 0) {
      const duration = 2000
      const steps = duration / 20
      let step = 0
      const interval = setInterval(() => {
        step++
        setAnimatedStats({
          properties: Math.min(stats.properties, Math.floor((step / steps) * stats.properties)),
          rooms: Math.min(stats.rooms, Math.floor((step / steps) * stats.rooms)),
          tenants: Math.min(stats.tenants, Math.floor((step / steps) * stats.tenants)),
        })
        if (step >= steps) clearInterval(interval)
      }, 20)
      return () => clearInterval(interval)
    }
  }, [stats])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Fetch real data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const { data: props } = await supabase
          .from('properties')
          .select(`
            id,
            name,
            city,
            address,
            photos,
            rooms (id, monthly_rent)
          `)
          .order('created_at', { ascending: false })
          .limit(6)

        const filtered = (props || []).filter(p => p.rooms && p.rooms.length > 0)
        setProperties(filtered)

        const { count: propertiesCount } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
        const { count: roomsCount } = await supabase
          .from('rooms')
          .select('*', { count: 'exact', head: true })
        const { count: tenantsCount } = await supabase
          .from('tenants')
          .select('*', { count: 'exact', head: true })

        setStats({
          properties: propertiesCount || 0,
          rooms: roomsCount || 0,
          tenants: tenantsCount || 0,
        })
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const features = [
    { icon: '💰', title: 'Easy Rent Collection', desc: 'Auto reminders & online payments', gradient: 'from-amber-500 to-orange-500' },
    { icon: '🔒', title: 'Bank-grade Security', desc: 'Your data is always protected', gradient: 'from-emerald-500 to-teal-500' },
    { icon: '⚡', title: 'Real-time Updates', desc: 'Instant notifications & tracking', gradient: 'from-blue-500 to-cyan-500' },
    { icon: '👥', title: 'Tenant Management', desc: 'Easy onboarding & tracking', gradient: 'from-purple-500 to-pink-500' },
    { icon: '🏢', title: 'Multi-Property', desc: 'Manage all properties in one place', gradient: 'from-indigo-500 to-purple-500' },
    { icon: '🎯', title: 'Smart Insights', desc: 'Analytics to grow your business', gradient: 'from-rose-500 to-pink-500' },
  ]

  const testimonials = [
    { name: 'Rajesh Kumar', role: 'Property Owner', text: 'HOSTELSET transformed my business. Rent collection is now effortless!', rating: 5, avatar: '👨', type: 'owner' },
    { name: 'Priya Sharma', role: 'Tenant', text: 'Found my perfect PG within days. The platform is super easy to use.', rating: 5, avatar: '👩', type: 'tenant' },
    { name: 'Amit Patel', role: 'Owner', text: 'The analytics dashboard helps me track everything in real time.', rating: 5, avatar: '👨', type: 'owner' },
    { name: 'Neha Gupta', role: 'Tenant', text: 'Safe, secure, and hassle‑free. Highly recommended!', rating: 5, avatar: '👩', type: 'tenant' },
  ]

  const filteredTestimonials = testimonials.filter(t => t.type === activeTab)

  // Animation variants
  const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } }
  }
  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  }

  const Section = ({ children, className = '' }) => {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, amount: 0.2 })
    const controls = useAnimation()
    useEffect(() => {
      if (isInView) controls.start('visible')
    }, [isInView, controls])
    return (
      <motion.section
        ref={ref}
        initial="hidden"
        animate={controls}
        variants={fadeUp}
        className={`py-24 px-4 ${className}`}
      >
        {children}
      </motion.section>
    )
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      {/* Custom Cursor (optional, uncomment for premium feel) */}
      {/* <motion.div
        className="fixed w-6 h-6 bg-purple-500 rounded-full mix-blend-difference pointer-events-none z-[100] hidden lg:block"
        animate={{ x: mouseX, y: mouseY }}
        transition={{ type: "spring", damping: 30, stiffness: 200 }}
      /> */}

      {/* ========== NAVBAR ========== */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 w-full z-50 transition-all duration-500 ${
          scrolled 
            ? 'bg-white/95 backdrop-blur-xl shadow-lg py-3' 
            : 'bg-transparent py-5'
        }`}
      >
        <div className="container mx-auto px-6 md:px-10">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center gap-2 group">
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
            
            <div className="hidden md:flex items-center gap-8">
              <Link href="/properties" className="text-gray-600 hover:text-slate-800 transition font-medium relative group">
                Browse Properties
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-slate-800 transition-all group-hover:w-full"></span>
              </Link>
              <Link href="/login" className="text-gray-600 hover:text-slate-800 transition font-medium">Login</Link>
              <Link 
                href="/register" 
                className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:shadow-xl transition-all hover:scale-105"
              >
                Get Started
              </Link>
            </div>
            
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="md:hidden p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-sm"
            >
              <span className="text-2xl">{mobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-4 right-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl z-40 md:hidden border border-gray-100 p-4"
          >
            <div className="flex flex-col gap-3">
              <Link href="/properties" className="py-3 text-center font-medium" onClick={() => setMobileMenuOpen(false)}>Browse Properties</Link>
              <Link href="/login" className="py-3 text-center font-medium" onClick={() => setMobileMenuOpen(false)}>Login</Link>
              <Link href="/register" className="bg-slate-800 text-white py-3 text-center rounded-xl font-medium" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== SPLIT-SCREEN HERO (Tenant / Owner) ========== */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Abstract animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50" />
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-500" />
        </div>

        <div className="relative container mx-auto px-6 md:px-10 pt-32 pb-20">
          {/* Animated welcome badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <span className="inline-block px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm text-sm font-semibold text-gray-700 border border-gray-200 shadow-sm">
              ✨ The future of PG & hostel management
            </span>
          </motion.div>

          {/* Split decision cards */}
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="grid md:grid-cols-2 gap-6 mb-16"
            >
              {/* Tenant Card */}
              <motion.div
                whileHover={{ scale: 1.02, y: -5 }}
                onClick={() => setActiveTab('tenant')}
                className={`cursor-pointer rounded-3xl p-8 backdrop-blur-sm border transition-all duration-300 ${
                  activeTab === 'tenant'
                    ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-2xl'
                    : 'bg-white/80 border-gray-200 hover:shadow-xl'
                }`}
              >
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-2xl font-bold mb-2">I'm a Tenant</h3>
                <p className={activeTab === 'tenant' ? 'text-purple-100' : 'text-gray-600'}>
                  Find the perfect PG/hostel near you. Safe, verified, and hassle‑free.
                </p>
              </motion.div>

              {/* Owner Card */}
              <motion.div
                whileHover={{ scale: 1.02, y: -5 }}
                onClick={() => setActiveTab('owner')}
                className={`cursor-pointer rounded-3xl p-8 backdrop-blur-sm border transition-all duration-300 ${
                  activeTab === 'owner'
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-2xl'
                    : 'bg-white/80 border-gray-200 hover:shadow-xl'
                }`}
              >
                <div className="text-5xl mb-4">🏢</div>
                <h3 className="text-2xl font-bold mb-2">I'm an Owner</h3>
                <p className={activeTab === 'owner' ? 'text-emerald-100' : 'text-gray-600'}>
                  List your property, manage tenants, and collect rent effortlessly.
                </p>
              </motion.div>
            </motion.div>

            {/* Dynamic content based on selected role */}
            <AnimatePresence mode="wait">
              {activeTab === 'tenant' && (
                <motion.div
                  key="tenant"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight">
                    <span className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                      Find your
                    </span>
                    <br />
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      perfect PG
                    </span>
                  </h1>
                  <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
                    Discover thousands of verified properties, transparent pricing, and instant booking.
                  </p>
                  <Link href="/properties" className="inline-flex items-center gap-2 bg-purple-600 text-white px-8 py-4 rounded-full font-semibold hover:shadow-xl transition hover:scale-105">
                    Browse Properties <span>→</span>
                  </Link>
                </motion.div>
              )}

              {activeTab === 'owner' && (
                <motion.div
                  key="owner"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight">
                    <span className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                      Manage your
                    </span>
                    <br />
                    <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                      property empire
                    </span>
                  </h1>
                  <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
                    Automate rent collection, track occupancy, and grow your business with powerful analytics.
                  </p>
                  <Link href="/owner/register-property" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-full font-semibold hover:shadow-xl transition hover:scale-105">
                    List Your Property <span>→</span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Animated Stats - same for both */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-16"
          >
            {[
              { icon: '🏢', value: animatedStats.properties, label: 'Properties Listed' },
              { icon: '🏠', value: animatedStats.rooms, label: 'Rooms Available' },
              { icon: '👥', value: animatedStats.tenants, label: 'Happy Tenants' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + i * 0.1 }}
                whileHover={{ y: -5, scale: 1.05 }}
                className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 text-center border border-gray-100 shadow-sm hover:shadow-xl transition-all"
              >
                <div className="text-4xl mb-2">{stat.icon}</div>
                <div className="text-3xl font-bold text-slate-800">{stat.value}+</div>
                <div className="text-gray-500 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========== FEATURED PROPERTIES (Tenant focused) ========== */}
      <Section>
        <div className="container mx-auto px-6 md:px-10">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Featured Properties
            </h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto">Discover handpicked PG and hostels near you</p>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl">
              <p className="text-gray-500">No properties available yet. Check back soon!</p>
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {properties.map((property) => (
                <motion.div
                  key={property.id}
                  variants={fadeUp}
                  whileHover={{ y: -10 }}
                  className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100"
                >
                  <div className="relative h-56 overflow-hidden">
                    {property.photos && property.photos[0] ? (
                      <img 
                        src={property.photos[0]} 
                        alt={property.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-gray-100 to-gray-200">
                        🏠
                      </div>
                    )}
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-slate-800">
                      {property.rooms?.length} rooms
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-slate-800 mb-1">{property.name}</h3>
                    <p className="text-gray-500 text-sm mb-3 flex items-center gap-1">
                      <span>📍</span> {property.city}
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="text-purple-600 font-bold">
                        ₹{formatCurrency(property.rooms?.[0]?.monthly_rent || 5000)}/mo
                      </span>
                      <Link 
                        href={`/property/${property.id}`}
                        className="text-slate-600 hover:text-slate-800 flex items-center gap-1 text-sm font-medium transition group-hover:gap-2"
                      >
                        View Details <span>→</span>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
          <div className="text-center mt-10">
            <Link href="/properties" className="inline-flex items-center gap-2 text-purple-600 font-semibold hover:gap-3 transition-all">
              Browse All Properties <span>→</span>
            </Link>
          </div>
        </div>
      </Section>

      {/* ========== FEATURES GRID (Owner focused) ========== */}
      <Section className="bg-gradient-to-br from-gray-50 to-white">
        <div className="container mx-auto px-6 md:px-10">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Powerful Tools for Owners</h2>
            <p className="text-xl text-gray-500">Everything you need to manage your PG business efficiently</p>
          </div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                variants={fadeUp}
                whileHover={{ y: -8, scale: 1.02 }}
                className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100"
              >
                <div className={`text-5xl mb-5 bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ========== TESTIMONIALS CAROUSEL ========== */}
      <Section>
        <div className="container mx-auto px-6 md:px-10">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">What Our Community Says</h2>
            <p className="text-xl text-gray-500">Real stories from tenants and property owners</p>
            <div className="flex justify-center gap-4 mt-6">
              <button
                onClick={() => setActiveTab('tenant')}
                className={`px-6 py-2 rounded-full transition ${
                  activeTab === 'tenant' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                Tenants
              </button>
              <button
                onClick={() => setActiveTab('owner')}
                className={`px-6 py-2 rounded-full transition ${
                  activeTab === 'owner' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                Owners
              </button>
            </div>
          </div>
          <div className="relative max-w-3xl mx-auto">
            <AnimatePresence mode="wait">
              {filteredTestimonials.map((testimonial, idx) => (
                idx === currentTestimonial % filteredTestimonials.length && (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.5 }}
                    className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="text-5xl">{testimonial.avatar}</div>
                      <div>
                        <div className="font-bold text-xl text-slate-800">{testimonial.name}</div>
                        <div className="text-gray-500">{testimonial.role}</div>
                      </div>
                    </div>
                    <div className="flex text-yellow-400 mb-4">
                      {'★'.repeat(testimonial.rating)}{'☆'.repeat(5-testimonial.rating)}
                    </div>
                    <p className="text-gray-600 text-lg leading-relaxed">"{testimonial.text}"</p>
                  </motion.div>
                )
              ))}
            </AnimatePresence>
            <div className="flex justify-center gap-2 mt-6">
              {filteredTestimonials.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentTestimonial(idx)}
                  className={`w-2 h-2 rounded-full transition ${
                    idx === currentTestimonial % filteredTestimonials.length ? 'bg-purple-600 w-4' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ========== CTA SECTION ========== */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 to-slate-800" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000" />
        </div>
        <div className="relative container mx-auto px-6 md:px-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Join thousands of property owners and tenants who have streamlined their business with HOSTELSET.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 justify-center">
            <Link href="/register" className="bg-white text-slate-800 px-8 py-3 rounded-full font-semibold hover:shadow-xl transition hover:scale-105">
              Start Free Trial
            </Link>
            <Link href="/properties" className="border-2 border-white/30 text-white px-8 py-3 rounded-full font-semibold hover:bg-white/10 transition">
              Browse Properties
            </Link>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="bg-gray-900 text-gray-400 pt-16 pb-8">
        <div className="container mx-auto px-6 md:px-10">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🏠</span>
                <span className="text-xl font-bold text-white">HOSTELSET</span>
              </div>
              <p className="text-sm leading-relaxed">India's most trusted PG & hostel management platform. Set Your Hostel, Simplify Life.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Explore</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/properties" className="hover:text-white transition">Browse Properties</Link></li>
                <li><Link href="/login" className="hover:text-white transition">Login</Link></li>
                <li><Link href="/register" className="hover:text-white transition">Register</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-white transition">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-white transition">Contact</Link></li>
                <li><Link href="/blog" className="hover:text-white transition">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} HOSTELSET. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
