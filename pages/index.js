import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, useAnimation, useInView } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/utils'

export default function Home() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [properties, setProperties] = useState([])
  const [stats, setStats] = useState({ properties: 0, rooms: 0, tenants: 0, revenue: 0 })
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
          .limit(6)
        const filtered = (props || []).filter(p => p.rooms?.length > 0)
        setProperties(filtered)

        const { count: propertiesCount } = await supabase.from('properties').select('*', { count: 'exact', head: true })
        const { count: roomsCount } = await supabase.from('rooms').select('*', { count: 'exact', head: true })
        const { count: tenantsCount } = await supabase.from('tenants').select('*', { count: 'exact', head: true })
        const { data: payments } = await supabase.from('payment_history').select('amount').eq('status', 'success')
        const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0

        setStats({
          properties: propertiesCount || 0,
          rooms: roomsCount || 0,
          tenants: tenantsCount || 0,
          revenue: totalRevenue,
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
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* ========== NAVBAR ========== */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#0a0a0f]/80 backdrop-blur-md border-b border-gray-800 py-3' : 'bg-transparent py-5'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🏠</span>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">HOSTELSET</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/properties" className="text-gray-300 hover:text-purple-400 transition">Properties</Link>
            <Link href="/login" className="text-gray-300 hover:text-purple-400 transition">Login</Link>
            <Link href="/register" className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white px-5 py-2 rounded-full text-sm font-semibold hover:shadow-lg transition">Get Started</Link>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-2xl">☰</button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed top-16 left-0 right-0 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-gray-800 z-40 md:hidden p-4">
          <div className="flex flex-col gap-3">
            <Link href="/properties" className="py-2 text-center" onClick={() => setMobileMenuOpen(false)}>Properties</Link>
            <Link href="/login" className="py-2 text-center" onClick={() => setMobileMenuOpen(false)}>Login</Link>
            <Link href="/register" className="bg-purple-600 text-white py-2 text-center rounded-full" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
          </div>
        </div>
      )}

      {/* ========== HERO ========== */}
      <section className="relative min-h-[90vh] flex items-center pt-20">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-cyan-900/20" />
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-5xl md:text-7xl font-bold leading-tight">
              We run <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">infrastructure</span>,<br />you lead innovation.
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-xl text-gray-400 mt-6 max-w-2xl">
              — The smarter way to build, run, and scale your PG & hostel business.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-wrap gap-4 mt-10">
              <Link href="/properties" className="group bg-gradient-to-r from-purple-600 to-cyan-600 text-white px-6 py-3 rounded-full font-semibold hover:shadow-xl transition flex items-center gap-2">
                See Platform in action
                <span className="group-hover:translate-x-1 transition">→</span>
              </Link>
              <Link href="/register" className="border border-gray-600 text-gray-300 px-6 py-3 rounded-full font-semibold hover:border-purple-400 hover:text-purple-400 transition">
                Join our guided tour
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== STATS CARDS (uptime, performance) ========== */}
      <div className="container mx-auto px-6 -mt-10 relative z-10">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-black/40 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 text-center">
            <div className="text-4xl font-bold text-purple-400">97.8%</div>
            <div className="text-gray-400 mt-1">Uptime</div>
            <div className="text-xs text-gray-500">60-day monitoring</div>
          </div>
          <div className="bg-black/40 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 text-center">
            <div className="text-4xl font-bold text-cyan-400">+31.2%</div>
            <div className="text-gray-400 mt-1">Performance</div>
            <div className="text-xs text-gray-500">AI optimized build</div>
          </div>
          <div className="bg-black/40 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 text-center">
            <div className="text-4xl font-bold text-green-400">₹{(stats.revenue / 100000).toFixed(1)}L+</div>
            <div className="text-gray-400 mt-1">Revenue collected</div>
            <div className="text-xs text-gray-500">via HOSTELSET</div>
          </div>
        </div>
      </div>

      {/* ========== MODULAR SERVICES (01 Neural Network, 02 Core Services, etc.) ========== */}
      <Section>
        <div className="container mx-auto px-6">
          <div className="flex justify-between items-center mb-12 border-b border-gray-800 pb-4">
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">modular by design</h2>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Our Services</span>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="border-l-4 border-purple-500 pl-6">
              <div className="text-5xl font-black text-purple-500/40 mb-2">01</div>
              <h3 className="text-2xl font-bold">Neural Network</h3>
              <p className="text-gray-400 mt-2">Self-learning systems that train smarter and faster — AI-driven vacancy predictions and dynamic pricing.</p>
            </div>
            <div className="border-l-4 border-cyan-500 pl-6">
              <div className="text-5xl font-black text-cyan-500/40 mb-2">02</div>
              <h3 className="text-2xl font-bold">Core Services</h3>
              <p className="text-gray-400 mt-2">Modular, flexible solutions for modern digital infrastructure — rent collection, tenant management, analytics.</p>
            </div>
            <div className="border-l-4 border-gray-600 pl-6">
              <div className="text-5xl font-black text-gray-600/40 mb-2">03</div>
              <h3 className="text-2xl font-bold">Future‑proof Systems</h3>
              <p className="text-gray-400 mt-2">Scale seamlessly and adapt to your business needs. Platform by design.</p>
            </div>
            <div className="border-l-4 border-gray-600 pl-6">
              <div className="text-5xl font-black text-gray-600/40 mb-2">04</div>
              <h3 className="text-2xl font-bold">24/7 Support</h3>
              <p className="text-gray-400 mt-2">Global coverage with real-time system health monitoring and dedicated account managers.</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ========== PROPERTIES GRID (modular cards) ========== */}
      <Section className="bg-black/40">
        <div className="container mx-auto px-6">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold">Featured modular stays</h2>
            <Link href="/properties" className="text-purple-400 hover:text-purple-300 text-sm">View all →</Link>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"/></div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No properties yet. Check back soon.</div>
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid md:grid-cols-3 gap-6">
              {properties.map(p => (
                <motion.div key={p.id} variants={fadeUp} whileHover={{ y: -5 }} className="bg-black/30 border border-gray-800 rounded-2xl overflow-hidden hover:border-purple-500/50 transition">
                  <div className="h-44 overflow-hidden bg-gray-900">
                    {p.photos?.[0] ? <img src={p.photos[0]} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-4xl">🏠</div>}
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-semibold">{p.name}</h3>
                    <p className="text-gray-400 text-sm">{p.city}</p>
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-purple-400 font-bold">₹{formatCurrency(p.rooms?.[0]?.monthly_rent||5000)}<span className="text-xs text-gray-500">/mo</span></span>
                      <Link href={`/property/${p.id}`} className="text-cyan-400 text-sm hover:underline">modular view →</Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </Section>

      {/* ========== GLOBAL SYSTEM STATUS (like the image: uptime, support locations) ========== */}
      <Section className="border-t border-gray-800">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Global System Status</h2>
            <p className="text-gray-400 mt-2">Real-time platform health across regions</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-black/40 border border-gray-800 rounded-2xl p-6 text-center">
              <div className="text-2xl font-bold text-purple-400">Amsterdam</div>
              <div className="flex justify-center gap-4 mt-3 text-sm">
                <span>🟢 24/7 support</span>
                <span className="text-green-400">99% Uptime</span>
              </div>
            </div>
            <div className="bg-black/40 border border-gray-800 rounded-2xl p-6 text-center">
              <div className="text-2xl font-bold text-cyan-400">New York</div>
              <div className="flex justify-center gap-4 mt-3 text-sm">
                <span>🟢 24/7 support</span>
                <span className="text-green-400">99% Uptime</span>
              </div>
            </div>
            <div className="bg-black/40 border border-gray-800 rounded-2xl p-6 text-center">
              <div className="text-2xl font-bold text-emerald-400">Dubai</div>
              <div className="flex justify-center gap-4 mt-3 text-sm">
                <span>🟢 24/7 support</span>
                <span className="text-green-400">99% Uptime</span>
              </div>
            </div>
          </div>
          <div className="mt-10 flex justify-center">
            <div className="bg-black/40 border border-gray-800 rounded-full px-6 py-2 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-sm text-gray-300">All systems operational</span>
              <span className="text-xs text-gray-500 ml-2">Last check: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </Section>

      {/* ========== PERFORMANCE METRICS (cards) ========== */}
      <Section>
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-6 max-w-3xl mx-auto text-center">
            <div className="border border-gray-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-purple-400">100%</div>
              <div className="text-gray-400 text-sm">Data accuracy</div>
            </div>
            <div className="border border-gray-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-cyan-400">100%</div>
              <div className="text-gray-400 text-sm">Uptime SLA</div>
            </div>
            <div className="border border-gray-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-green-400">99.9%</div>
              <div className="text-gray-400 text-sm">Payment success</div>
            </div>
            <div className="border border-gray-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-yellow-400">24/7</div>
              <div className="text-gray-400 text-sm">Human support</div>
            </div>
          </div>
        </div>
      </Section>

      {/* ========== CTA + BOOK A DEMO ========== */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/30 via-transparent to-cyan-900/30" />
        <div className="container mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">modular by design</h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">Ready to transform your PG business with a modular, future‑proof platform?</p>
            <Link href="/register" className="inline-block bg-gradient-to-r from-purple-600 to-cyan-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-xl transition transform hover:scale-105">
              book a demo →
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-gray-800 py-12">
        <div className="container mx-auto px-6 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} HOSTELSET — modular platform for modern PG management.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/privacy" className="hover:text-purple-400 transition">Privacy</Link>
            <Link href="/terms" className="hover:text-purple-400 transition">Terms</Link>
            <Link href="/contact" className="hover:text-purple-400 transition">Contact</Link>
            <span className="text-gray-600">|</span>
            <span className="text-xs">System status: 🟢 operational</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
