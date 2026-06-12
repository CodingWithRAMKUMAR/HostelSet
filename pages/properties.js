import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/utils'

export default function PropertiesPage() {
  const [properties, setProperties] = useState([])
  const [filteredProperties, setFilteredProperties] = useState([])
  const [cities, setCities] = useState([])
  const [selectedCity, setSelectedCity] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProperties()
  }, [])

  useEffect(() => {
    // Filter properties by city and search query
    let filtered = properties
    if (selectedCity) {
      filtered = filtered.filter(p => p.city === selectedCity)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          (p.city && p.city.toLowerCase().includes(q))
      )
    }
    setFilteredProperties(filtered)
  }, [selectedCity, searchQuery, properties])

  const loadProperties = async () => {
    setLoading(true)
    try {
      // Fetch all active properties
      const { data: propertiesData, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('is_active', true)

      if (propError) throw propError

      if (!propertiesData || propertiesData.length === 0) {
        setProperties([])
        setFilteredProperties([])
        setLoading(false)
        return
      }

      // Fetch rooms for all these properties
      const propertyIds = propertiesData.map(p => p.id)
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .in('property_id', propertyIds)

      if (roomsError) throw roomsError

      // Attach room stats to each property
      const propertiesWithStats = propertiesData.map(property => {
        const rooms = roomsData?.filter(r => r.property_id === property.id) || []
        const totalRooms = rooms.length
        const occupiedRooms = rooms.filter(r => r.current_occupants >= r.capacity).length
        const lowestRent = rooms.length > 0 ? Math.min(...rooms.map(r => r.monthly_rent)) : null
        return {
          ...property,
          totalRooms,
          occupiedRooms,
          lowestRent,
          firstPhoto: property.photos && property.photos.length > 0 ? property.photos[0] : null,
        }
      })

      // Extract unique cities for filter
      const uniqueCities = [...new Set(propertiesWithStats.map(p => p.city).filter(Boolean))]
      setCities(uniqueCities.sort())
      setProperties(propertiesWithStats)
      setFilteredProperties(propertiesWithStats)
    } catch (error) {
      console.error('Error loading properties:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-10">
        <div className="container mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-slate-800 mb-3"
          >
            🏠 Find Your Perfect PG
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-500 mb-8"
          >
            Browse properties, check rooms, and apply directly
          </motion.p>

          {/* Search & Filter */}
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search by property name or city..."
              className="flex-1 px-4 py-3 border border-gray-200 rounded-full focus:outline-none focus:border-slate-800 transition"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <select
              className="px-4 py-3 border border-gray-200 rounded-full focus:outline-none focus:border-slate-800 transition"
              value={selectedCity}
              onChange={e => setSelectedCity(e.target.value)}
            >
              <option value="">All Cities</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Property Cards */}
      <div className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🏠</div>
            <p className="text-gray-500">No properties found. Try a different search or city.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProperties.map((property, index) => (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100"
              >
                {/* Image */}
                <div className="h-48 bg-gray-100 relative">
                  {property.firstPhoto ? (
                    <img
                      src={property.firstPhoto}
                      alt={property.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-5xl text-gray-300">
                      🏢
                    </div>
                  )}
                  {property.lowestRent && (
                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold text-slate-800">
                      From {formatCurrency(property.lowestRent)}/mo
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-5">
                  <h3 className="text-xl font-bold text-slate-800 mb-1">{property.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">{property.city || 'Location not specified'}</p>
                  <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
                    <span>🏠 {property.totalRooms} rooms</span>
                    <span>🛏️ {property.occupiedRooms}/{property.totalRooms} occupied</span>
                  </div>
                  <Link
                    href={`/property/${property.id}`}
                    className="block w-full bg-slate-800 text-white text-center py-2.5 rounded-full font-semibold hover:bg-slate-700 transition"
                  >
                    View Details →
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
