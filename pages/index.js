import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRouter } from 'next/router'
import BrandLogo from '../components/BrandLogo'
import ThemeToggle from '../components/common/ThemeToggle'

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.hostelset.com').replace(/\/$/, '')
const HOME_TITLE = 'HostelSet | Discover and Manage Hostels & PGs'
const HOME_DESCRIPTION = 'Browse hostel and PG properties, review rooms and rent, apply online, or manage properties, tenants, payments, notices, and requests with HostelSet.'
const HOME_IMAGE = `${SITE_URL}/brand/logo-primary.png`

export default function Home() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const ticking = useRef(false)

  const { scrollYProgress } = useScroll()
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.8])

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 50
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          setScrolled(isScrolled)
          ticking.current = false
        })
        ticking.current = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    // close mobile menu on navigation
    const handleRouteChange = () => setMobileMenuOpen(false)
    router.events.on('routeChangeComplete', handleRouteChange)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [])

  const features = [
    { icon: '💰', title: 'Easy Rent Collection', desc: 'Auto reminders and online payments', color: 'from-orange-500 to-amber-600' },
    { icon: '🔒', title: 'Secure & Safe', desc: 'Bank-grade security for all data', color: 'from-orange-600 to-yellow-500' },
    { icon: '⏰', title: 'Real-time Updates', desc: 'Instant notifications and tracking', color: 'from-amber-500 to-yellow-600' },
    { icon: '👥', title: 'Tenant Management', desc: 'Easy onboarding and tracking', color: 'from-orange-500 to-amber-600' },
    { icon: '🏢', title: 'Multi-Property', desc: 'Manage multiple properties', color: 'from-amber-600 to-yellow-500' },
    { icon: '⭐', title: '24/7 Support', desc: 'Dedicated support team', color: 'from-orange-500 to-amber-600' },
  ]

  const stats = [
    { value: '500+', label: 'Happy Tenants', icon: '👥', delay: 0 },
    { value: '100+', label: 'Properties', icon: '🏢', delay: 0.1 },
    { value: '₹10Cr+', label: 'Rent Collected', icon: '💰', delay: 0.2 },
    { value: '99.9%', label: 'Uptime', icon: '🔒', delay: 0.3 },
  ]

  const steps = [
    { number: '01', title: 'Register Your Property', desc: 'Sign up and list your property details in minutes', icon: '📝', color: 'from-orange-500 to-amber-500' },
    { number: '02', title: 'Add Rooms & Tenants', desc: 'Manage rooms, add tenants, set rent amounts easily', icon: '🏠', color: 'from-orange-600 to-yellow-500' },
    { number: '03', title: 'Start Earning', desc: 'Collect rent online, track payments, grow business', icon: '💰', color: 'from-amber-500 to-orange-600' },
  ]

  const publicSchemas = JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'HostelSet',
      url: SITE_URL,
      logo: HOME_IMAGE,
      email: 'contact@hostelset.com',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'HostelSet',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: SITE_URL,
      description: HOME_DESCRIPTION,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'HostelSet',
      url: SITE_URL,
      description: HOME_DESCRIPTION,
    },
  ]).replace(/</g, '\\u003c')

  return (
    <>
      <Head>
        <title>{HOME_TITLE}</title>
        <meta name="description" content={HOME_DESCRIPTION} />
        <link rel="canonical" href={SITE_URL} />
        <meta property="og:site_name" content="HostelSet" />
        <meta property="og:title" content={HOME_TITLE} />
        <meta property="og:description" content={HOME_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={HOME_IMAGE} />
        <meta property="og:image:alt" content="HostelSet" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={HOME_TITLE} />
        <meta name="twitter:description" content={HOME_DESCRIPTION} />
        <meta name="twitter:url" content={SITE_URL} />
        <meta name="twitter:image" content={HOME_IMAGE} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: publicSchemas }} />
      </Head>

      <div className="min-h-screen bg-black text-white">
        {/* Navbar */}
        <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${
          scrolled 
            ? 'bg-black/90 backdrop-blur-xl shadow-lg py-3 border-b border-gray-800' 
            : 'bg-transparent py-6'
        }`}>
          <div className="container mx-auto px-4 md:px-8">
            <div className="flex justify-between items-center">
              <Link href="/" className="flex items-center" aria-label="HostelSet home">
                <BrandLogo priority />
              </Link>
              
              <div className="hidden md:flex items-center gap-4">
                <ThemeToggle />
                <Link 
                  href="/properties" 
                  className="px-5 py-2.5 rounded-full border-2 border-orange-600 text-orange-400 font-semibold hover:bg-orange-600 hover:text-white transition-all duration-300 flex items-center gap-2"
                >
                  <span>🔍</span>
                  Browse Properties
                </Link>
                <Link 
                  href="/login" 
                  className="px-5 py-2.5 rounded-full border-2 border-gray-500 text-gray-300 font-semibold hover:border-orange-500 hover:text-orange-400 transition-all duration-300 flex items-center gap-2"
                >
                  <span>👤</span>
                  Login
                </Link>
                <Link 
                  href="/register" 
                  className="bg-gradient-to-r from-orange-600 to-amber-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:shadow-xl hover:shadow-orange-500/25 transition-all duration-300 hover:scale-105 flex items-center gap-2"
                >
                  <span>✨</span>
                  Register
                </Link>
              </div>
              
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
                className="md:hidden p-3 rounded-full bg-black/50 backdrop-blur-sm border border-gray-700"
              >
                <span className="text-2xl">{mobileMenuOpen ? '✕' : '☰'}</span>
              </button>
            </div>
          </div>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-4 right-4 bg-black/95 backdrop-blur-xl rounded-2xl shadow-2xl z-40 md:hidden border border-gray-800"
          >
            <div className="p-4">
              <div className="mb-3 flex justify-center">
                <ThemeToggle />
              </div>
              <Link 
                href="/properties" 
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-orange-600 text-orange-400 font-semibold hover:bg-orange-600 hover:text-white transition-all duration-300 mb-3"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>🔍</span>
                Browse Properties
              </Link>
              <Link 
                href="/login" 
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-gray-500 text-gray-300 font-semibold hover:border-orange-500 hover:text-orange-400 transition-all duration-300 mb-3"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>👤</span>
                Login
              </Link>
              <Link 
                href="/register" 
                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-orange-600 to-amber-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span>✨</span>
                Register
              </Link>
            </div>
          </motion.div>
        )}

        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black" />
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-20 left-10 w-72 h-72 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
            <div className="absolute bottom-20 right-10 w-72 h-72 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000" />
            <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-orange-600 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-500" />
          </div>

          <div className="relative container mx-auto px-4 md:px-8 pt-32 pb-20">
            <div className="max-w-5xl mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="inline-flex items-center gap-3 bg-black/50 backdrop-blur-sm rounded-full px-5 py-2.5 mb-8 shadow-sm border border-gray-700"
                >
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                  </span>
                  <span className="text-sm font-medium text-gray-300">🚀 Trusted by 100+ Property Owners</span>
                </motion.div>
                
                <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight">
                  <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent">
                    Find Your
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                    Perfect PG
                  </span>
                </h1>
                
                <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                  Set Your Hostel, Simplify Life. Browse PGs, apply instantly, and pay rent directly to the owner.
                </p>
                
                {/* Removed Get Started Free and List Your Property */}
              </motion.div>

              {/* Stats Cards */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: 0.05 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
              >
                {stats.map((stat, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: stat.delay + 0.5, type: "spring" }}
                    whileHover={{ y: -5, scale: 1.05 }}
                    className="bg-black/40 backdrop-blur-sm rounded-2xl p-6 text-center border border-gray-800 shadow-sm hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300"
                  >
                    <div className="text-3xl mb-3">{stat.icon}</div>
                    <div className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">{stat.value}</div>
                    <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* Quick Access Section – Register, Browse, Login */}
        <section className="py-20 bg-gray-950">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold">
                <span className="bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent">
                  Find Your Perfect PG
                </span>
              </h2>
              <p className="text-gray-400 mt-4">Three simple ways to get started</p>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <motion.div whileHover={{ y: -5 }} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center hover:shadow-xl hover:shadow-orange-500/10 transition-all">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-bold text-white mb-3">Browse Properties</h3>
                <p className="text-gray-400 mb-6">Explore available PGs and rooms in your city</p>
                <Link href="/properties" className="inline-block bg-orange-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-orange-700 transition">
                  Browse Now
                </Link>
              </motion.div>
              <motion.div whileHover={{ y: -5 }} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center hover:shadow-xl hover:shadow-orange-500/10 transition-all">
                <div className="text-4xl mb-4">📝</div>
                <h3 className="text-xl font-bold text-white mb-3">Register</h3>
                <p className="text-gray-400 mb-6">Create an account to manage your property or apply as a tenant</p>
                <Link href="/register" className="inline-block bg-gradient-to-r from-orange-600 to-amber-600 text-white px-6 py-3 rounded-full font-semibold hover:shadow-lg transition">
                  Register Free
                </Link>
              </motion.div>
              <motion.div whileHover={{ y: -5 }} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center hover:shadow-xl hover:shadow-orange-500/10 transition-all">
                <div className="text-4xl mb-4">👤</div>
                <h3 className="text-xl font-bold text-white mb-3">Login</h3>
                <p className="text-gray-400 mb-6">Already have an account? Sign in to your dashboard</p>
                <Link href="/login" className="inline-block border-2 border-orange-600 text-orange-400 px-6 py-3 rounded-full font-semibold hover:bg-orange-600 hover:text-white transition">
                  Login
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-black relative">
          <div className="container mx-auto px-4 md:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center max-w-3xl mx-auto mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Why Choose{' '}
                <span className="bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent">
                  HOSTELSET
                </span>
                ?
              </h2>
              <p className="text-xl text-gray-400">
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
                  className="group relative bg-gray-900 rounded-2xl p-8 border border-gray-800 shadow-sm hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-500 overflow-hidden"
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${feature.color} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`} />
                  <div className="relative">
                    <div className="text-5xl mb-5 group-hover:scale-110 transition-transform duration-300">{feature.icon}</div>
                    <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                    <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 bg-gray-950">
          <div className="container mx-auto px-4 md:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center max-w-3xl mx-auto mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                How{' '}
                <span className="bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent">
                  HOSTELSET
                </span>{' '}
                Works
              </h2>
              <p className="text-xl text-gray-400">Get started in three simple steps</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-gray-800 via-orange-500 to-gray-800 -translate-y-1/2" />
              {steps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.2 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -8 }}
                  className="relative bg-gray-900 rounded-2xl p-8 text-center shadow-lg hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-300 z-10 border border-gray-800"
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                    <div className={`w-14 h-14 bg-gradient-to-r ${step.color} rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20`}>
                      <span className="text-2xl text-white">{step.icon}</span>
                    </div>
                  </div>
                  <div className="mt-8 mb-4">
                    <div className="text-5xl font-bold bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent">
                      {step.number}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-gray-400">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-gray-800 bg-black py-14" aria-labelledby="homepage-faq-title"><div className="container mx-auto px-4"><div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-5 rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center sm:flex-row sm:text-left"><div><h2 id="homepage-faq-title" className="text-2xl font-bold text-white">Have questions?</h2><p className="mt-2 text-gray-400">Find clear answers about applications, payments, tenant management, and more.</p></div><Link href="/faq" className="shrink-0 rounded-full bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">View FAQs</Link></div></div></section>

        {/* Footer */}
        <footer className="bg-gray-950 border-t border-gray-800 py-16">
          <div className="container mx-auto px-4 md:px-8">
            <div className="grid md:grid-cols-4 gap-12">
              <div>
                <div className="flex items-center mb-6">
                  <BrandLogo size="footer" />
                </div>
                <p className="text-gray-500 mb-6 leading-relaxed">
                  Set Your Hostel, Simplify Life. India's most trusted PG and hostel management platform.
                </p>
                <div className="flex gap-4">
                  <a href="#" className="text-gray-600 hover:text-orange-500 transition-all duration-300 hover:scale-110 text-xl">📘</a>
                  <a href="#" className="text-gray-600 hover:text-orange-500 transition-all duration-300 hover:scale-110 text-xl">🐦</a>
                  <a href="#" className="text-gray-600 hover:text-orange-500 transition-all duration-300 hover:scale-110 text-xl">📷</a>
                  <a href="#" className="text-gray-600 hover:text-orange-500 transition-all duration-300 hover:scale-110 text-xl">🔗</a>
                </div>
              </div>
              <div>
                <h4 className="font-bold text-white mb-6 text-lg">Product</h4>
                <ul className="space-y-3 text-gray-500">
                  <li><a href="#" className="hover:text-orange-400 transition">Features</a></li>
                  <li><Link href="/login" className="hover:text-orange-400 transition">Login</Link></li>
                  <li><Link href="/register" className="hover:text-orange-400 transition">Register</Link></li>
                  <li><Link href="/properties" className="hover:text-orange-400 transition">Browse Properties</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-white mb-6 text-lg">Company</h4>
                <ul className="space-y-3 text-gray-500">
                  <li><Link href="/about" className="hover:text-orange-400 transition">About Us</Link></li>
                  <li><Link href="/contact" className="hover:text-orange-400 transition">Contact</Link></li>
                  <li><Link href="/support" className="hover:text-orange-400 transition">Support</Link></li>
                  <li><Link href="/faq" className="hover:text-orange-400 transition">FAQ</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-white mb-6 text-lg">Legal</h4>
                <ul className="space-y-3 text-gray-500">
                  <li><Link href="/privacy-policy" className="hover:text-orange-400 transition">Privacy Policy</Link></li>
                  <li><Link href="/terms" className="hover:text-orange-400 transition">Terms of Service</Link></li>
                  <li><Link href="/refund-policy" className="hover:text-orange-400 transition">Refund Policy</Link></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-600">
              <p>&copy; 2026 HOSTELSET. All rights reserved. Made with ❤️ for PG owners</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
