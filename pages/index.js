import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, useAnimation, useInView } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [stats, setStats] = useState({ uptime: 99.97, performance: 31.2, security: 99.99, scalability: 100 })

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // In a real implementation, you could fetch these from Supabase
  // For now, they are static to match the modular SaaS style.

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
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
        className={`py-20 px-4 ${className}`}
      >
        {children}
      </motion.section>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* ========== NAVBAR ========== */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-black/90 backdrop-blur-md border-b border-orange-500/20 py-3' : 'bg-transparent py-5'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl">🏠</span>
            <span className="text-xl font-bold tracking-tight">HOSTELSET</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/platform" className="text-gray-300 hover:text-orange-400 transition">Platform</Link>
            <Link href="/login" className="text-gray-300 hover:text-orange-400 transition">Login</Link>
            <Link href="/register" className="bg-orange-600 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-orange-500 transition shadow-lg">Get Started</Link>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-2xl">☰</button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed top-16 left-0 right-0 bg-black/95 backdrop-blur-md border-b border-orange-500/20 z-40 md:hidden p-4">
          <div className="flex flex-col gap-3">
            <Link href="/platform" className="py-2 text-center text-gray-300" onClick={() => setMobileMenuOpen(false)}>Platform</Link>
            <Link href="/login" className="py-2 text-center text-gray-300" onClick={() => setMobileMenuOpen(false)}>Login</Link>
            <Link href="/register" className="bg-orange-600 text-white py-2 text-center rounded-full" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
          </div>
        </div>
      )}

      {/* ========== HERO – "We run infrastructure, you lead innovation" ========== */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        {/* Abstract orange glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-orange-600/20 rounded-full blur-3xl" />
        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              We run <span className="text-orange-500">infrastructure</span>,<br />
              you lead innovation.
            </h1>
            <p className="text-xl text-gray-400 mt-6 max-w-2xl mx-auto">
              The smarter way to build, run, and scale your PG & hostel business.
            </p>
            <div className="flex flex-wrap gap-4 justify-center mt-10">
              <Link href="/register" className="bg-orange-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-orange-500 transition shadow-lg inline-flex items-center gap-2">
                See Platform in action <span>→</span>
              </Link>
              <Link href="/demo" className="border border-gray-600 text-gray-300 px-8 py-3 rounded-full font-semibold hover:border-orange-500 hover:text-orange-400 transition">
                Book a demo
              </Link>
            </div>
          </motion.div>

          {/* Stats row – uptime, performance, etc. */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto mt-20"
          >
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
              <div className="text-3xl font-bold text-orange-400">{stats.uptime}%</div>
              <div className="text-gray-400 text-sm">Uptime</div>
              <div className="text-xs text-gray-500">60-day monitoring</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
              <div className="text-3xl font-bold text-orange-400">+{stats.performance}%</div>
              <div className="text-gray-400 text-sm">Performance</div>
              <div className="text-xs text-gray-500">AI optimized build</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
              <div className="text-3xl font-bold text-orange-400">{stats.security}%</div>
              <div className="text-gray-400 text-sm">Security</div>
              <div className="text-xs text-gray-500">Bank‑grade encryption</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
              <div className="text-3xl font-bold text-orange-400">{stats.scalability}%</div>
              <div className="text-gray-400 text-sm">Scalability</div>
              <div className="text-xs text-gray-500">Unlimited growth</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== MODULAR BY DESIGN – tagline ========== */}
      <div className="text-center py-12 border-y border-white/10">
        <p className="text-2xl md:text-3xl font-light tracking-wider text-orange-300">modular by design</p>
      </div>

      {/* ========== OUR SERVICES – 4 cards with numbers ========== */}
      <Section>
        <div className="container mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">Our Services</h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-12">Modular, flexible solutions for modern PG & hostel management.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-orange-500/50 transition">
              <div className="text-5xl font-black text-orange-500 mb-4">01</div>
              <h3 className="text-xl font-semibold mb-2">Neural Rent Collection</h3>
              <p className="text-gray-400">Self‑learning systems that optimise payment reminders and automate reconciliation.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-orange-500/50 transition">
              <div className="text-5xl font-black text-orange-500 mb-4">02</div>
              <h3 className="text-xl font-semibold mb-2">Smart Analytics</h3>
              <p className="text-gray-400">Real‑time occupancy, revenue forecasts, and AI‑driven insights.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-orange-500/50 transition">
              <div className="text-5xl font-black text-orange-500 mb-4">03</div>
              <h3 className="text-xl font-semibold mb-2">Core Services</h3>
              <p className="text-gray-400">Modular, flexible solutions for modern digital infrastructure.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-orange-500/50 transition">
              <div className="text-5xl font-black text-orange-500 mb-4">04</div>
              <h3 className="text-xl font-semibold mb-2">Future‑proof Systems</h3>
              <p className="text-gray-400">Scale seamlessly, adapt to your business needs. Platform by design.</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ========== GLOBAL PRESENCE + SYSTEM HEALTH ========== */}
      <div className="py-20 bg-white/5">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Left: Global offices */}
            <div>
              <h2 className="text-3xl font-bold mb-6">Global <span className="text-orange-400">presence</span></h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <div><span className="text-orange-400">📍</span> Delhi, India</div>
                  <div className="text-gray-400">24/7 support • 99.9% uptime</div>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <div><span className="text-orange-400">📍</span> Bangalore, India</div>
                  <div className="text-gray-400">24/7 support • 99.9% uptime</div>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <div><span className="text-orange-400">📍</span> Mumbai, India</div>
                  <div className="text-gray-400">24/7 support • 99.9% uptime</div>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <div><span className="text-orange-400">📍</span> Dubai, UAE</div>
                  <div className="text-gray-400">24/7 support • 99.9% uptime</div>
                </div>
              </div>
            </div>
            {/* Right: System health / metrics */}
            <div>
              <h2 className="text-3xl font-bold mb-6">System <span className="text-orange-400">health</span></h2>
              <div className="space-y-4">
                <div className="bg-black/30 rounded-xl p-4 border border-white/10">
                  <div className="flex justify-between text-sm text-gray-400"><span>API Response</span><span>98.2ms</span></div>
                  <div className="w-full bg-gray-800 rounded-full h-2 mt-2"><div className="bg-orange-500 rounded-full h-2" style={{ width: '98%' }}></div></div>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/10">
                  <div className="flex justify-between text-sm text-gray-400"><span>Database Uptime</span><span>99.99%</span></div>
                  <div className="w-full bg-gray-800 rounded-full h-2 mt-2"><div className="bg-orange-500 rounded-full h-2" style={{ width: '99.99%' }}></div></div>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/10">
                  <div className="flex justify-between text-sm text-gray-400"><span>AI Model Accuracy</span><span>94.7%</span></div>
                  <div className="w-full bg-gray-800 rounded-full h-2 mt-2"><div className="bg-orange-500 rounded-full h-2" style={{ width: '95%' }}></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========== PLATFORM PARTNERS / METRICS ========== */}
      <Section>
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Platinum <span className="text-orange-400">Partners</span></h2>
          <p className="text-gray-400 text-center mb-12">Trusted by the leading PG networks</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="text-center p-6 border border-white/10 rounded-2xl bg-white/5">
              <div className="text-3xl font-bold text-orange-400">97%</div>
              <div className="text-gray-400">Uptime (SLA)</div>
            </div>
            <div className="text-center p-6 border border-white/10 rounded-2xl bg-white/5">
              <div className="text-3xl font-bold text-orange-400">+51%</div>
              <div className="text-gray-400">Performance gain</div>
            </div>
            <div className="text-center p-6 border border-white/10 rounded-2xl bg-white/5">
              <div className="text-3xl font-bold text-orange-400">96%</div>
              <div className="text-gray-400">Integration success</div>
            </div>
          </div>
        </div>
      </Section>

      {/* ========== BOOK A DEMO / FINAL CTA ========== */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-600/20 to-transparent blur-3xl" />
        <div className="container mx-auto px-6 text-center relative">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Ready to lead <span className="text-orange-500">innovation?</span></h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">Join our guided tour and explore all features live with a platform expert.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/demo" className="bg-orange-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-orange-500 transition shadow-lg">Book a demo →</Link>
            <Link href="/register" className="border border-gray-600 text-gray-300 px-8 py-3 rounded-full font-semibold hover:border-orange-500 hover:text-orange-400 transition">Start free trial</Link>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-white/10 py-12">
        <div className="container mx-auto px-6 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} HOSTELSET — modular by design. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/privacy" className="hover:text-orange-400 transition">Privacy</Link>
            <Link href="/terms" className="hover:text-orange-400 transition">Terms</Link>
            <Link href="/contact" className="hover:text-orange-400 transition">Contact</Link>
            <Link href="/status" className="hover:text-orange-400 transition">System Status</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
