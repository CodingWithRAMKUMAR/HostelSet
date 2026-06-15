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
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    const handleMouseMove = (e) => setMousePosition({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('mousemove', handleMouseMove)
    }
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
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* ========== CUSTOM CURSOR (premium effect) ========== */}
      <div
        className="fixed w-8 h-8 rounded-full bg-purple-500/20 backdrop-blur-sm pointer-events-none z-50 hidden lg:block"
        style={{ transform: `translate(${mousePosition.x - 16}px, ${mousePosition.y - 16}px)`, transition: 'transform 0.1s ease-out' }}
      />

      {/* ========== ANIMATED BACKGROUND BLOBS ========== */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />
      </div>

      {/* ========== NAVBAR ========== */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl">🏠</span>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">HOSTELSET</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/properties" className="text-gray-600 hover:text-purple-600 transition">Explore</Link>
            <Link href="/login" className="text-gray-600 hover:text-purple-600 transition">Login</Link>
            <Link href="/register" className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2 rounded-full text-sm font-semibold hover:shadow-lg transition">Get Started</Link>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-2xl">☰</button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed top-16 left-0 right-0 bg-white/95 backdrop-blur-md shadow-lg z-40 md:hidden p-4">
          <div className="flex flex-col gap-3">
            <Link href="/properties" className="py-2 text-center" onClick={() => setMobileMenuOpen(false)}>Explore</Link>
            <Link href="/login" className="py-2 text-center" onClick={() => setMobileMenuOpen(false)}>Login</Link>
            <Link href="/register" className="bg-purple-600 text-white py-2 text-center rounded-full" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
          </div>
        </div>
      )}

      {/* ========== HERO – BOLD & ARTISTIC ========== */}
      <section className="relative min-h-screen flex items-center pt-20">
        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, type: 'spring' }}
          >
            <h1 className="text-5xl md:text-7xl font-black text-slate-800 leading-tight">
              Live <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">better</span>,<br />
              manage <span className="bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">smarter</span>
            </h1>
            <p className="text-xl text-gray-500 mt-6 max-w-2xl mx-auto">
              The all‑in‑one platform for PG tenants and owners – discover, list, and manage effortlessly.
            </p>
            <div className="flex flex-wrap gap-4 justify-center mt-10">
              <Link href="/properties" className="group relative inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105">
                Explore properties
                <span className="group-hover:translate-x-1 transition">→</span>
              </Link>
              <Link href="/owner/register-property" className="inline-flex items-center gap-2 border-2 border-slate-300 text-slate-700 px-8 py-3 rounded-full font-semibold hover:border-purple-500 hover:bg-purple-50 transition">
                List your property
              </Link>
            </div>
          </motion.div>

          {/* Artistic floating stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-20"
          >
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 border border-white/40 shadow-xl">
              <div className="text-4xl mb-2">🏢</div>
              <div className="text-3xl font-bold text-purple-600">{stats.properties}+</div>
              <div className="text-gray-500">Properties</div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 border border-white/40 shadow-xl">
              <div className="text-4xl mb-2">🏠</div>
              <div className="text-3xl font-bold text-purple-600">{stats.rooms}+</div>
              <div className="text-gray-500">Rooms</div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 border border-white/40 shadow-xl">
              <div className="text-4xl mb-2">👥</div>
              <div className="text-3xl font-bold text-purple-600">{stats.tenants}+</div>
              <div className="text-gray-500">Happy tenants</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== FEATURED PROPERTIES – ARTISTIC CARDS ========== */}
      <Section>
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-slate-800">✨ Featured gems</h2>
            <p className="text-gray-500 mt-2">Unique spaces, handpicked for you</p>
          </div>
          {loading ? (
            <div className="flex justify-center"><div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"/></div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl">No properties yet. Check back soon!</div>
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {properties.map((property) => (
                <motion.div key={property.id} variants={fadeUp} whileHover={{ y: -8, rotate: 1 }} className="group bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-100 transition-all">
                  <div className="relative h-52 overflow-hidden">
                    {property.photos?.[0] ? <img src={property.photos[0]} alt={property.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" /> : <div className="w-full h-full flex items-center justify-center text-5xl bg-gray-100">🏠</div>}
                    <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">{property.rooms?.length} rooms</div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-bold text-slate-800">{property.name}</h3>
                    <p className="text-gray-500 text-sm flex items-center gap-1 mt-1"><span>📍</span> {property.city}</p>
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-purple-600 font-bold">₹{formatCurrency(property.rooms?.[0]?.monthly_rent || 5000)}<span className="text-sm">/mo</span></span>
                      <Link href={`/property/${property.id}`} className="text-slate-600 hover:text-purple-600 flex items-center gap-1 text-sm font-medium">View →</Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
          <div className="text-center mt-10"><Link href="/properties" className="text-purple-600 font-semibold hover:underline">Browse all →</Link></div>
        </div>
      </Section>

      {/* ========== DUAL PURPOSE – SPLIT WITH ART ========== */}
      <div className="bg-gradient-to-r from-indigo-50 to-pink-50 py-20 my-12">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="text-center md:text-left">
              <div className="text-5xl mb-4">🔑</div>
              <h3 className="text-2xl font-bold text-slate-800">For tenants</h3>
              <p className="text-gray-600 mt-2">Discover verified PGs, compare prices, and book in minutes.</p>
              <Link href="/properties" className="inline-block mt-4 text-purple-600 font-medium hover:underline">Find your home →</Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="text-center md:text-left">
              <div className="text-5xl mb-4">📈</div>
              <h3 className="text-2xl font-bold text-slate-800">For owners</h3>
              <p className="text-gray-600 mt-2">Manage tenants, collect rent online, and scale your business.</p>
              <Link href="/owner/register-property" className="inline-block mt-4 text-purple-600 font-medium hover:underline">List your property →</Link>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ========== CTA WITH FLUID SHAPE ========== */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-800 to-pink-800 rounded-t-[100px] md:rounded-t-[150px]" />
        <div className="absolute inset-0 opacity-30"><div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-pulse" /></div>
        <div className="relative container mx-auto px-6 text-center text-white">
          <h2 className="text-3xl md:text-5xl font-black mb-4">Start your journey today</h2>
          <p className="text-purple-100 mb-8 max-w-xl mx-auto">Join the community of thousands who simplified their PG life with HOSTELSET.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/register" className="bg-white text-purple-800 px-6 py-2 rounded-full font-semibold hover:shadow-lg transition">Sign up free</Link>
            <Link href="/properties" className="border-2 border-white text-white px-6 py-2 rounded-full font-semibold hover:bg-white/10 transition">Explore</Link>
          </div>
        </div>
      </section>

      {/* ========== FOOTER (minimal) ========== */}
      <footer className="bg-white text-gray-500 py-12 border-t border-gray-100">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm">© {new Date().getFullYear()} HOSTELSET — India's most trusted PG & hostel platform.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/privacy" className="text-sm hover:text-purple-600">Privacy</Link>
            <Link href="/terms" className="text-sm hover:text-purple-600">Terms</Link>
            <Link href="/contact" className="text-sm hover:text-purple-600">Contact</Link>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}
