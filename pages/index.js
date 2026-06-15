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

  const { scrollYProgress } = useScroll()
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, 150])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0])

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
    { name: 'Rajesh Kumar', role: 'Property Owner', text: 'HOSTELSET transformed my business. Rent collection is now effortless!', rating: 5, avatar: '👨' },
    { name: 'Priya Sharma', role: 'Tenant', text: 'Found my perfect PG within days. The platform is super easy to use.', rating: 5, avatar: '👩' },
    { name: 'Amit Patel', role: 'Owner', text: 'The analytics dashboard helps me track everything in real time.', rating: 5, avatar: '👨' },
  ]

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
    <div className="min-h-screen overflow-x-hidden">
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

      {/* ========== HERO SECTION ========== */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-stone-50 via-white to-stone-100">
        {/* Abstract background shapes */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-96 h-96 bg-amber-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-stone-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-500" />
        </div>

        <div className="relative container mx-auto px-6 md:px-10 pt-32 pb-20">
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
                className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 mb-6 shadow-sm border border-stone-200"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-sm font-medium text-stone-700">Trusted by 500+ Property Owners</span>
              </motion.div>
              
              <motion.h1 
                className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight"
                variants={fadeUp}
              >
                <span className="bg-gradient-to-r from-stone-800 to-stone-600 bg-clip-text text-transparent">
                  Find your
                </span>
                <br />
                <span className="bg-gradient-to-r from-emerald-700 to-teal-600 bg-clip-text text-transparent">
                  perfect PG
                </span>
              </motion.h1>
              
              <motion.p 
                className="text-xl text-stone-500 mb-10 max-w-2xl mx-auto leading-relaxed"
                variants={fadeUp}
              >
                Hostel management simplified. Connect with trusted properties, manage rent effortlessly, and grow your business — all in one place.
              </motion.p>
              
              <motion.div 
                className="flex flex-col sm:flex-row gap-5 justify-center mb-16"
                variants={fadeUp}
              >
                <Link 
                  href="/register" 
                  className="group relative bg-gradient-to-r from-stone-800 to-stone-700 text-white px-10 py-4 rounded-full font-semibold hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Start Free Trial
                    <span className="group-hover:translate-x-1 transition">→</span>
                  </span>
                </Link>
                <Link 
                  href="/properties" 
                  className="border-2 border-stone-300 text-stone-700 px-10 py-4 rounded-full font-semibold hover:border-stone-800 hover:bg-stone-50 transition-all duration-300 hover:scale-105 backdrop-blur-sm"
                >
                  Browse Properties
                </Link>
              </motion.div>
            </motion.div>

            {/* Animated Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto"
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
                  transition={{ delay: 0.6 + i * 0.1 }}
                  whileHover={{ y: -5, scale: 1.05 }}
                  className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 text-center border border-stone-100 shadow-sm hover:shadow-xl transition-all"
                >
                  <div className="text-4xl mb-2">{stat.icon}</div>
                  <div className="text-3xl font-bold text-stone-800">{stat.value}+</div>
                  <div className="text-stone-500 mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== FEATURED PROPERTIES ========== */}
      <Section>
        <div className="container mx-auto px-6 md:px-10">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-stone-800 to-stone-600 bg-clip-text text-transparent">
              Featured Properties
            </h2>
            <p className="text-xl text-stone-500 max-w-2xl mx-auto">Discover handpicked PG and hostels near you</p>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin"></div>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12 bg-stone-50 rounded-2xl">
              <p className="text-stone-500">No properties available yet. Check back soon!</p>
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
                  className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-stone-100"
                >
                  <div className="relative h-56 overflow-hidden">
                    {property.photos && property.photos[0] ? (
                      <img 
                        src={property.photos[0]} 
                        alt={property.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-stone-100 to-stone-200">
                        🏠
                      </div>
                    )}
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-stone-800">
                      {property.rooms?.length} rooms
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-stone-800 mb-1">{property.name}</h3>
                    <p className="text-stone-500 text-sm mb-3 flex items-center gap-1">
                      <span>📍</span> {property.city}
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-600 font-bold">
                        ₹{formatCurrency(property.rooms?.[0]?.monthly_rent || 5000)}/mo
                      </span>
                      <Link 
                        href={`/property/${property.id}`}
                        className="text-stone-600 hover:text-stone-800 flex items-center gap-1 text-sm font-medium transition group-hover:gap-2"
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
            <Link href="/properties" className="inline-flex items-center gap-2 text-emerald-600 font-semibold hover:gap-3 transition-all">
              Browse All Properties <span>→</span>
            </Link>
          </div>
        </div>
      </Section>

      {/* ========== FEATURES GRID ========== */}
      <Section className="bg-gradient-to-br from-stone-50 to-white">
        <div className="container mx-auto px-6 md:px-10">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-stone-800">Why Choose HOSTELSET?</h2>
            <p className="text-xl text-stone-500">Everything you need to manage your PG business efficiently</p>
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
                className="bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 border border-stone-100"
              >
                <div className={`text-5xl mb-5 bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-stone-800 mb-3">{feature.title}</h3>
                <p className="text-stone-500 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ========== TESTIMONIALS ========== */}
      <Section>
        <div className="container mx-auto px-6 md:px-10">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-stone-800">What Our Users Say</h2>
            <p className="text-xl text-stone-500">Join thousands of satisfied property owners and tenants</p>
          </div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-6"
          >
            {testimonials.map((t, idx) => (
              <motion.div
                key={idx}
                variants={fadeUp}
                whileHover={{ y: -5 }}
                className="bg-white rounded-2xl p-6 shadow-lg border border-stone-100"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">{t.avatar}</div>
                  <div>
                    <div className="font-semibold text-stone-800">{t.name}</div>
                    <div className="text-sm text-stone-500">{t.role}</div>
                  </div>
                </div>
                <div className="flex text-amber-400 mb-3">
                  {'★'.repeat(t.rating)}{'☆'.repeat(5-t.rating)}
                </div>
                <p className="text-stone-600 leading-relaxed">"{t.text}"</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ========== CTA SECTION ========== */}
      <section className="relative py-24 overflow-hidden bg-gradient-to-r from-stone-900 to-stone-800">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000" />
        </div>
        <div className="relative container mx-auto px-6 md:px-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-stone-300 mb-10 max-w-2xl mx-auto">
            Join thousands of property owners who have streamlined their business with HOSTELSET.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 justify-center">
            <Link href="/register" className="bg-white text-stone-800 px-8 py-3 rounded-full font-semibold hover:shadow-xl transition hover:scale-105">
              Start Free Trial
            </Link>
            <Link href="/properties" className="border-2 border-white/30 text-white px-8 py-3 rounded-full font-semibold hover:bg-white/10 transition">
              Browse Properties
            </Link>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="bg-stone-900 text-stone-400 pt-16 pb-8">
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
          <div className="border-t border-stone-800 pt-6 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} HOSTELSET. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
