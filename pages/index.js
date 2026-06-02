import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { formatCurrency, getPropertyTypeLabel } from '../lib/utils'

export default function Home() {
  const [scrolled, setScrolled] = useState(false)
  const [properties, setProperties] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCity, setSelectedCity] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [cities, setCities] = useState([])

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

  const filteredProperties = properties.filter(prop => {
    if (selectedCity !== 'all' && prop.city !== selectedCity) return false
    if (selectedType !== 'all' && prop.property_type !== selectedType) return false
    if (searchQuery && !prop.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !prop.city.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const features = [
    { icon: '💰', title: 'Easy Rent Collection', desc: 'Auto reminders and online payments', color: 'from-green-500 to-emerald-500' },
    { icon: '📊', title: 'Smart Analytics', desc: 'Real-time occupancy tracking', color: 'from-blue-500 to-cyan-500' },
    { icon: '🔧', title: 'Maintenance', desc: 'Quick complaint resolution', color: 'from-orange-500 to-red-500' },
    { icon: '🏠', title: 'Room Management', desc: 'Easy allocation and tracking', color: 'from-purple-500 to-pink-500' },
    { icon: '🔒', title: 'Secure', desc: 'Bank-grade security', color: 'from-indigo-500 to-blue-500' },
    { icon: '📱', title: 'Mobile Ready', desc: 'Access from anywhere', color: 'from-teal-500 to-green-500' },
  ]

  return (
    <div className="min-h-screen">
      <nav className={`navbar py-4 px-6 flex justify-between items-center fixed top-0 w-full z-50 transition-all ${scrolled ? 'shadow-lg' : ''}`}>
        <Link href="/" className="text-2xl font-bold text-primary">🏠 HOSTELSET</Link>
        <div className="flex gap-6 items-center">
          <Link href="#features" className="text-gray-300 hover:text-primary hidden md:inline">Features</Link>
          <Link href="#properties" className="text-gray-300 hover:text-primary hidden md:inline">Properties</Link>
          <Link href="/login" className="text-gray-300 hover:text-primary">Login</Link>
          <Link href="/owner/register-property" className="btn-primary text-sm">List Property</Link>
        </div>
      </nav>

      <div className="pt-32 pb-16 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="text-7xl mb-6 animate-float">🏠</div>
          <h1 className="hero-title">Find Your Perfect PG</h1>
          <p className="hero-subtitle">Set Your Hostel, Simplify Life</p>
          <div className="max-w-2xl mx-auto mt-8 flex flex-col md:flex-row gap-4">
            <input type="text" placeholder="Search by city, area, or PG name..." className="input flex-1" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <button className="btn-primary" onClick={() => {}}>🔍 Search</button>
          </div>
        </motion.div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="stat-card"><div className="stat-number">10,000+</div><div className="stat-label">Happy Tenants</div></div>
          <div className="stat-card"><div className="stat-number">500+</div><div className="stat-label">Properties</div></div>
          <div className="stat-card"><div className="stat-number">₹50Cr+</div><div className="stat-label">Rent Collected</div></div>
          <div className="stat-card"><div className="stat-number">99.9%</div><div className="stat-label">Satisfaction</div></div>
        </div>
      </div>

      <section id="features" className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Why Choose <span className="text-primary">HOSTELSET</span>?</h2>
        <div className="feature-grid">
          {features.map((feature, i) => (
            <motion.div key={i} whileHover={{ y: -5 }} className="card text-center">
              <div className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl`}>{feature.icon}</div>
              <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="properties" className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-3 justify-center mb-8">
          <button onClick={() => setSelectedCity('all')} className={`px-4 py-2 rounded-full text-sm ${selectedCity === 'all' ? 'bg-primary text-white' : 'bg-secondary text-gray-300'}`}>All Cities</button>
          {cities.map(city => (
            <button key={city} onClick={() => setSelectedCity(city)} className={`px-4 py-2 rounded-full text-sm ${selectedCity === city ? 'bg-primary text-white' : 'bg-secondary text-gray-300'}`}>{city}</button>
          ))}
          <button onClick={() => setSelectedType('all')} className={`px-4 py-2 rounded-full text-sm ${selectedType === 'all' ? 'bg-primary text-white' : 'bg-secondary text-gray-300'}`}>All Types</button>
          <button onClick={() => setSelectedType('boys')} className={`px-4 py-2 rounded-full text-sm ${selectedType === 'boys' ? 'bg-primary text-white' : 'bg-secondary text-gray-300'}`}>👨 Boys PG</button>
          <button onClick={() => setSelectedType('girls')} className={`px-4 py-2 rounded-full text-sm ${selectedType === 'girls' ? 'bg-primary text-white' : 'bg-secondary text-gray-300'}`}>👩 Girls PG</button>
          <button onClick={() => setSelectedType('co-ed')} className={`px-4 py-2 rounded-full text-sm ${selectedType === 'co-ed' ? 'bg-primary text-white' : 'bg-secondary text-gray-300'}`}>👥 Co-ed PG</button>
        </div>

        {loading ? (
          <div className="text-center py-20"><div className="spinner"></div><p className="mt-4 text-gray-400">Loading properties...</p></div>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-6">{filteredProperties.length} Properties Found</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProperties.map((property) => {
                const availableRooms = getAvailableRoomsCount(property.id)
                return (
                  <motion.div key={property.id} whileHover={{ y: -5 }} className="card">
                    <div className="flex justify-between items-start">
                      <h3 className="text-xl font-bold">{property.name}</h3>
                      <span className="badge-info">{getPropertyTypeLabel(property.property_type)}</span>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">📍 {property.city}</p>
                    <p className="text-gray-500 text-sm line-clamp-2 mt-2">{property.description}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {property.amenities?.slice(0, 3).map((a, i) => <span key={i} className="text-xs bg-dark px-2 py-1 rounded-full">{a}</span>)}
                    </div>
                    <div className="flex justify-between items-center mt-4">
                      <div><span className="text-primary font-bold">{formatCurrency(property.min_rent || 8000)}</span><span className="text-gray-500 text-sm">/month</span></div>
                      <span className="badge-success">{availableRooms} rooms available</span>
                    </div>
                    <Link href={`/property/${property.id}`} className="btn-primary text-sm mt-4 inline-block w-full text-center">View Details →</Link>
                  </motion.div>
                )
              })}
            </div>
          </>
        )}
      </section>

      <div className="bg-secondary mx-4 my-12 rounded-2xl p-12 text-center">
        <h2 className="text-2xl font-bold mb-4">Own a PG? List Your Property</h2>
        <p className="text-gray-400 mb-6">Join 500+ property owners using HOSTELSET</p>
        <Link href="/owner/register-property" className="btn-primary">List Your Property →</Link>
      </div>

      <footer className="text-center py-8 text-gray-500 text-sm border-t border-gray-800">
        <p>© 2024 HOSTELSET. All rights reserved.</p>
      </footer>
    </div>
  )
}
