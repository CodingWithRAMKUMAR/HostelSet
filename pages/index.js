import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, useAnimation, useInView, AnimatePresence } from 'framer-motion'
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
          .select('id, name, city, address, photos, rooms(id, monthly_rent)')
          .order('created_at', { ascending: false })
          .limit(8)
        const filtered = (props || []).filter(p => p.rooms?.length > 0)
        setProperties(filtered)
        const { count: propertiesCount } = await supabase.from('properties').select('*', { count: 'exact', head: true })
        const { count: roomsCount } = await supabase.from('rooms').select('*', { count: 'exact', head: true })
        const { count: tenantsCount } = await supabase.from('tenants').select('*', { count: 'exact', head: true })
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
      {/* ========== NAVBAR ========== */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🏠</span>
            <span className="text-xl font-bold text-slate-800">HOSTELSET</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/properties" className="text-gray-600 hover:text-purple-600 transition">Explore</Link>
            <Link href="/login" className="text-gray-600 hover:text-purple-600 transition">Login</Link>
            <Link href="/register" className="bg-purple-600 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-purple-700 transition">Get Started</Link>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-2xl">☰</button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed top-16 left-0 right-0 bg-white shadow-lg z-40 md:hidden p-4">
          <div className="flex flex-col gap-3">
            <Link href="/properties" className="py-2 text-center" onClick={() => setMobileMenuOpen(false)}>Explore</Link>
            <Link href="/login" className="py-2 text-center" onClick={() => setMobileMenuOpen(false)}>Login</Link>
            <Link href="/register" className="bg-purple-600 text-white py-2 text-center rounded-full" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
          </div>
        </div>
      )}

      {/* ========== HERO – FIND YOUR VIBE ========== */}
      <section className="relative min-h-screen flex items-center pt-20 bg-gradient-to-br from-purple-50 via-white to-pink-50">
        <div className="container mx-auto px-6 text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-5xl md:text-7xl font-black text-slate-800 mb-4">
            UNIQUE <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">TEMPLATES</span>
          </motion.h1>
          <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-2xl md:text-3xl text-gray-600 mb-8">
            FIND YOUR VIBE
          </motion.h2>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="flex flex-wrap gap-3 justify-center">
            <span className="px-4 py-2 bg-white rounded-full shadow-sm">🏙️ URBAN SANCTUARY</span>
            <span className="px-4 py-2 bg-white rounded-full shadow-sm">🌊 RIDE THE WAVE</span>
            <span className="px-4 py-2 bg-white rounded-full shadow-sm">🌿 OUTDOOR REFRESH</span>
            <span className="px-4 py-2 bg-white rounded-full shadow-sm">📖 STORIED STAYS</span>
            <span className="px-4 py-2 bg-white rounded-full shadow-sm">🎉 VIBRANT SOCIAL</span>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-16">
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100 shadow-sm"><div className="text-3xl">🏢</div><div className="text-2xl font-bold text-purple-600">{stats.properties}+</div><div>Properties</div></div>
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100 shadow-sm"><div className="text-3xl">🏠</div><div className="text-2xl font-bold text-purple-600">{stats.rooms}+</div><div>Rooms</div></div>
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100 shadow-sm"><div className="text-3xl">👥</div><div className="text-2xl font-bold text-purple-600">{stats.tenants}+</div><div>Tenants</div></div>
          </div>
        </div>
      </section>

      {/* ========== URBAN SANCTUARY – bold monochromatic ========== */}
      <Section className="bg-black text-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">URBAN SANCTUARY.</h2>
          <p className="text-gray-400 mt-2 mb-12">Minimal. Industrial. Yours.</p>
          {loading ? <div className="w-8 h-8 border-2 border-white rounded-full animate-spin mx-auto"/> : (
            <div className="grid md:grid-cols-3 gap-6">
              {properties.slice(0,3).map(p => (
                <div key={p.id} className="bg-white/10 backdrop-blur-sm p-4 rounded-xl">
                  <div className="h-40 bg-gray-800 rounded-lg overflow-hidden">{p.photos?.[0] ? <img src={p.photos[0]} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-4xl">🏙️</div>}</div>
                  <h3 className="text-xl font-bold mt-3">{p.name}</h3>
                  <p className="text-gray-400">{p.city}</p>
                  <p className="text-purple-400 mt-2">from ₹{formatCurrency(p.rooms?.[0]?.monthly_rent||5000)}/mo</p>
                  <Link href={`/property/${p.id}`} className="inline-block mt-3 text-sm underline">View →</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ========== RIDE THE WAVE – vibrant, wave background ========== */}
      <div className="relative bg-gradient-to-r from-cyan-500 to-blue-600 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20"><div className="absolute bottom-0 w-full h-20 bg-white/20 rounded-t-full animate-pulse"/></div>
        <div className="container mx-auto px-6 py-20 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-black">🌊 RIDE THE WAVE</h2>
          <p className="text-cyan-100 mt-2 mb-10">Fresh, energetic spaces near the coast</p>
          <div className="grid md:grid-cols-2 gap-6">
            {properties.slice(3,5).map(p => (
              <div key={p.id} className="bg-white/20 backdrop-blur-sm rounded-2xl p-5 flex gap-4 items-center">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-white/30">{p.photos?.[0] ? <img src={p.photos[0]} className="w-full h-full object-cover"/> : <div className="text-4xl flex items-center justify-center h-full">🌊</div>}</div>
                <div className="text-left"><h3 className="text-xl font-bold">{p.name}</h3><p className="text-cyan-100">{p.city}</p><Link href={`/property/${p.id}`} className="text-sm underline">Ride now →</Link></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========== OUTDOOR REFRESH – glassmorphism, green tones ========== */}
      <Section className="bg-green-50">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-green-800">🌿 OUTDOOR REFRESH</h2>
          <p className="text-green-600 mb-10">Reconnect with nature</p>
          <div className="grid md:grid-cols-3 gap-6">
            {properties.slice(5,8).map(p => (
              <div key={p.id} className="bg-white/60 backdrop-blur-sm rounded-3xl p-5 shadow-lg border border-green-200">
                <div className="h-36 rounded-xl overflow-hidden">{p.photos?.[0] ? <img src={p.photos[0]} className="w-full h-full object-cover"/> : <div className="bg-green-100 h-full flex items-center justify-center text-4xl">🌿</div>}</div>
                <h3 className="text-xl font-semibold mt-3">{p.name}</h3>
                <p className="text-green-700 text-sm">{p.city}</p>
                <p className="text-green-800 font-bold mt-2">₹{formatCurrency(p.rooms?.[0]?.monthly_rent||5000)}/mo</p>
                <Link href={`/property/${p.id}`} className="text-green-600 text-sm font-medium inline-block mt-2">Refresh →</Link>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ========== STORIED STAYS – vintage, sepia ========== */}
      <div className="bg-amber-100 py-20" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(210,180,140,0.2) 0%, transparent 50%)' }}>
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-serif italic text-amber-900">📖 STORIED STAYS</h2>
          <p className="text-amber-700 mt-2 mb-10">Heritage charm, modern comfort</p>
          <div className="flex flex-wrap justify-center gap-6">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-5 w-80 border border-amber-300 shadow-xl">
              <div className="text-6xl mb-3">🏛️</div>
              <h3 className="text-xl font-bold">Heritage House</h3>
              <p className="text-amber-800">Starting at <span className="font-bold">₹999</span>/night</p>
              <Link href="/properties" className="inline-block mt-3 text-amber-700 underline">Book stay →</Link>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-5 w-80 border border-amber-300 shadow-xl">
              <div className="text-6xl mb-3">📜</div>
              <h3 className="text-xl font-bold">Classic Elegance</h3>
              <p className="text-amber-800">Starting at <span className="font-bold">₹1,299</span>/night</p>
              <Link href="/properties" className="inline-block mt-3 text-amber-700 underline">Book stay →</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ========== VIBRANT SOCIAL – neon, grid, community ========== */}
      <Section className="bg-gradient-to-br from-fuchsia-900 to-purple-900 text-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 to-pink-300">🎉 VIBRANT SOCIAL</h2>
          <p className="text-purple-200 mt-2 mb-10">Live, work, play together</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">👥 Team Dashboard</div>
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">🎮 Gaming Zone</div>
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">📸 Rooftop Events</div>
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">☕ Co‑working Cafe</div>
          </div>
          <div className="mt-10">
            <span className="inline-block bg-white/20 px-6 py-2 rounded-full text-sm">Backpacker focused · Budget friendly · Community first</span>
          </div>
        </div>
      </Section>

      {/* ========== PRICING CARDS (Startup Co‑stay & Heritage House) ========== */}
      <div className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-cyan-500 to-blue-500 text-white rounded-3xl p-8 shadow-2xl">
              <div className="text-5xl mb-4">🚀</div>
              <h3 className="text-2xl font-bold">STARTUP CO‑STAY</h3>
              <p className="text-cyan-100 mt-2">Designed for entrepreneurs & remote workers</p>
              <div className="mt-6 text-4xl font-black">$100 <span className="text-base font-normal">/month</span></div>
              <ul className="mt-4 space-y-2 text-sm">
                <li>✓ High‑speed WiFi</li>
                <li>✓ Ergonomic desk & chair</li>
                <li>✓ Access to co‑working lounge</li>
              </ul>
              <Link href="/register" className="inline-block mt-6 bg-white text-cyan-700 px-6 py-2 rounded-full font-semibold hover:shadow-lg">Join now →</Link>
            </div>
            <div className="bg-gradient-to-br from-amber-700 to-orange-800 text-white rounded-3xl p-8 shadow-2xl">
              <div className="text-5xl mb-4">🏰</div>
              <h3 className="text-2xl font-bold">HERITAGE HOUSE</h3>
              <p className="text-amber-100 mt-2">Live in history, with modern amenities</p>
              <div className="mt-6 text-4xl font-black">$100 <span className="text-base font-normal">/night</span></div>
              <ul className="mt-4 space-y-2 text-sm">
                <li>✓ Period furniture</li>
                <li>✓ Guided heritage tours</li>
                <li>✓ Authentic local cuisine</li>
              </ul>
              <Link href="/properties" className="inline-block mt-6 bg-white text-amber-800 px-6 py-2 rounded-full font-semibold hover:shadow-lg">Reserve →</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ========== FINAL CTA ========== */}
      <section className="bg-slate-900 text-white py-20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Your vibe, your stay.</h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">Join HOSTELSET today and discover a world of unique living experiences.</p>
          <Link href="/register" className="bg-purple-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-purple-700 transition">Get started — it's free</Link>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="bg-white border-t border-gray-100 py-12">
        <div className="container mx-auto px-6 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} HOSTELSET — Unique stays, unique designs.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/privacy" className="hover:text-purple-600">Privacy</Link>
            <Link href="/terms" className="hover:text-purple-600">Terms</Link>
            <Link href="/contact" className="hover:text-purple-600">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
