import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, useAnimation, useInView } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/utils'

export default function Home() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [properties, setProperties] = useState([])
  const [stats, setStats] = useState({ properties: 0, rooms: 0, tenants: 0 })
  const [loading, setLoading] = useState(true)

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
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
  }

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
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
        className={`py-20 px-4 ${className}`}
      >
        {children}
      </motion.section>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ========== NAVBAR ========== */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled ? 'bg-white shadow-md py-3' : 'bg-transparent py-5'
      }`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🏠</span>
            <span className="text-xl font-bold text-slate-800">HOSTELSET</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/properties" className="text-gray-600 hover:text-slate-800 transition">Properties</Link>
            <Link href="/login" className="text-gray-600 hover:text-slate-800 transition">Login</Link>
            <Link href="/register" className="bg-purple-600 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-purple-700 transition shadow-md">
              Get Started
            </Link>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden">
            <span className="text-2xl">{mobileMenuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed top-16 left-0 right-0 bg-white shadow-lg z-40 md:hidden p-4">
          <div className="flex flex-col gap-3">
            <Link href="/properties" className="py-2 text-center" onClick={() => setMobileMenuOpen(false)}>Properties</Link>
            <Link href="/login" className="py-2 text-center" onClick={() => setMobileMenuOpen(false)}>Login</Link>
            <Link href="/register" className="bg-purple-600 text-white py-2 text-center rounded-full" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
          </div>
        </div>
      )}

      {/* ========== HERO ========== */}
      <section className="relative min-h-screen flex items-center pt-20">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-purple-50" />
        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold text-slate-800 mb-6">
              Find your<span className="text-purple-600"> perfect PG</span>
            </h1>
            <p className="text-xl text-gray-500 mb-8 max-w-2xl mx-auto">
              India's most trusted platform for PG and hostel management. 
              For tenants: discover verified properties. For owners: simplify your business.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/properties" className="bg-purple-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-purple-700 transition shadow-lg">
                Browse Properties
              </Link>
              <Link href="/owner/register-property" className="border-2 border-slate-300 text-slate-700 px-8 py-3 rounded-full font-semibold hover:border-purple-600 hover:bg-purple-50 transition">
                List Your Property
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-16"
          >
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 text-center border border-gray-100 shadow-sm">
              <div className="text-3xl mb-2">🏢</div>
              <div className="text-2xl font-bold text-slate-800">{stats.properties}+</div>
              <div className="text-gray-500">Properties</div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 text-center border border-gray-100 shadow-sm">
              <div className="text-3xl mb-2">🏠</div>
              <div className="text-2xl font-bold text-slate-800">{stats.rooms}+</div>
              <div className="text-gray-500">Rooms</div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 text-center border border-gray-100 shadow-sm">
              <div className="text-3xl mb-2">👥</div>
              <div className="text-2xl font-bold text-slate-800">{stats.tenants}+</div>
              <div className="text-gray-500">Happy Tenants</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== FEATURED PROPERTIES ========== */}
      <Section>
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-3">Featured Properties</h2>
            <p className="text-gray-500">Handpicked PG and hostels just for you</p>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-purple-600 rounded-full animate-spin"></div>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl">
              <p className="text-gray-500">No properties yet. Check back soon.</p>
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
                  whileHover={{ y: -8 }}
                  className="group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
                >
                  <div className="relative h-48 overflow-hidden bg-gray-200">
                    {property.photos?.[0] ? (
                      <img src={property.photos[0]} alt={property.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🏠</div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-semibold text-slate-800 mb-1">{property.name}</h3>
                    <p className="text-gray-500 text-sm mb-2">{property.city}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-purple-600 font-bold">₹{formatCurrency(property.rooms?.[0]?.monthly_rent || 5000)}/mo</span>
                      <Link href={`/property/${property.id}`} className="text-slate-600 hover:text-purple-600 text-sm font-medium flex items-center gap-1">
                        View →</Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
          <div className="text-center mt-10">
            <Link href="/properties" className="text-purple-600 font-semibold hover:underline">Browse all properties →</Link>
          </div>
        </div>
      </Section>

      {/* ========== TWO COLUMN BENEFITS ========== */}
      <div className="bg-gray-50 py-20">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            <div className="text-center md:text-left">
              <div className="text-4xl mb-4">🔑</div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">For Tenants</h3>
              <p className="text-gray-600 mb-4">Find verified PGs, compare prices, and book instantly.</p>
              <Link href="/properties" className="text-purple-600 font-medium">Explore properties →</Link>
            </div>
            <div className="text-center md:text-left">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">For Owners</h3>
              <p className="text-gray-600 mb-4">Manage tenants, collect rent online, and grow your business.</p>
              <Link href="/owner/register-property" className="text-purple-600 font-medium">List your property →</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ========== CTA ========== */}
      <section className="bg-purple-700 py-16 text-center text-white">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-purple-100 mb-8 max-w-xl mx-auto">Join thousands of property owners and tenants using HOSTELSET.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/register" className="bg-white text-purple-700 px-6 py-2 rounded-full font-semibold hover:bg-gray-100 transition">Sign up for free</Link>
            <Link href="/properties" className="border-2 border-white text-white px-6 py-2 rounded-full font-semibold hover:bg-white/10 transition">Browse properties</Link>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-6 text-center">
          <p>&copy; {new Date().getFullYear()} HOSTELSET. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition">Terms</Link>
            <Link href="/contact" className="hover:text-white transition">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
