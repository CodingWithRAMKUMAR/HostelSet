import { useState, useEffect } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import { motion } from 'framer-motion'
import { publicSupabase as supabase } from '../lib/publicSupabase'
import { formatCurrency } from '../lib/utils'
import NearbyHostelMap from '../components/maps/NearbyHostelMap'
import { usePublicRealtimeRefresh as useRealtimeRefresh } from '../hooks/usePublicRealtimeRefresh'
import PublicFooter from '../components/PublicFooter'
import { propertyPublicPath } from '../lib/propertySlug'

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.hostelset.com').replace(/\/$/, '')
const PAGE_TITLE = 'Browse Hostels and PGs | HostelSet'
const PAGE_DESCRIPTION = 'Search active hostel and PG properties on HostelSet by city, room availability, rent, and location.'
const SOCIAL_IMAGE = `${SITE_URL}/brand/logo-primary.png`

function distanceKm(origin, property) {
  if (!origin || !Number.isFinite(property.latitude) || !Number.isFinite(property.longitude)) return null
  const radians = value => value * Math.PI / 180
  const dLat = radians(property.latitude - origin.latitude)
  const dLon = radians(property.longitude - origin.longitude)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(origin.latitude)) * Math.cos(radians(property.latitude)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState([])
  const [filteredProperties, setFilteredProperties] = useState([])
  const [cities, setCities] = useState([])
  const [selectedCity, setSelectedCity] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [view, setView] = useState('list')
  const [userLocation, setUserLocation] = useState(null)
  const [locationStatus, setLocationStatus] = useState('')

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
    const withDistance = filtered.map(property => ({ ...property, distance: distanceKm(userLocation, property) }))
    if (userLocation) withDistance.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
    setFilteredProperties(withDistance)
  }, [selectedCity, searchQuery, properties, userLocation])

  const useMyLocation = () => {
    if (!navigator.geolocation) { setLocationStatus('Location is not supported on this device.'); return }
    setLocationStatus('Finding your location…')
    navigator.geolocation.getCurrentPosition(
      position => { setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setLocationStatus('Showing nearest hostels first.'); setView('map') },
      () => setLocationStatus('Location permission was not available. You can still search by city.'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }

  const loadProperties = async (background = false) => {
    if (!background) setLoading(true)
    setLoadError('')
    try {
      const { data: propertiesData, error: propError } = await supabase.rpc('get_public_properties_v2')

      if (propError) throw propError

      if (!propertiesData || propertiesData.length === 0) {
        setProperties([])
        setFilteredProperties([])
        return
      }

      const propertiesWithStats = propertiesData.map(property => {
        return {
          ...property,
          totalRooms: Number(property.total_rooms || 0),
          availableRooms: Number(property.available_room_count || 0),
          activeTenantCount: Number(property.active_tenant_count || 0),
          lowestRent: property.lowest_rent == null ? null : Number(property.lowest_rent),
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
      setLoadError('Properties could not be loaded. Check your connection and try again.')
    } finally {
      if (!background) setLoading(false)
    }
  }

  useRealtimeRefresh('public-properties-live', ['properties', 'rooms', 'tenants'], loadProperties, true, 120)

  return (
    <>
      <Head>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <link rel="canonical" href={`${SITE_URL}/properties`} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="HostelSet" />
        <meta property="og:title" content={PAGE_TITLE} />
        <meta property="og:description" content={PAGE_DESCRIPTION} />
        <meta property="og:url" content={`${SITE_URL}/properties`} />
        <meta property="og:image" content={SOCIAL_IMAGE} />
        <meta property="og:image:alt" content="HostelSet" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={PAGE_TITLE} />
        <meta name="twitter:description" content={PAGE_DESCRIPTION} />
        <meta name="twitter:url" content={`${SITE_URL}/properties`} />
        <meta name="twitter:image" content={SOCIAL_IMAGE} />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-6">
        <div className="container mx-auto mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-bold text-slate-800">HostelSet</Link>
          <nav className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-600" aria-label="Browse navigation">
            <Link href="/" className="hover:text-slate-900">Home</Link>
            <Link href="/faq" className="hover:text-slate-900">FAQ</Link>
            <Link href="/login/tenant" className="hover:text-slate-900">Tenant Login</Link>
            <Link href="/register" className="rounded-full bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-700">Register Your Property</Link>
          </nav>
        </div>
        <div className="container mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-slate-800 mb-3"
          >
            Find Your Perfect PG
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-500 mb-8"
          >
            Compare rooms, rent, and facilities. Apply to a hostel first; tenant account access comes after owner approval.
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
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button onClick={useMyLocation} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Use my location</button>
            <button onClick={() => setView('list')} className={`rounded-full px-4 py-2 text-sm font-semibold ${view === 'list' ? 'bg-slate-800 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>List</button>
            <button onClick={() => setView('map')} className={`rounded-full px-4 py-2 text-sm font-semibold ${view === 'map' ? 'bg-slate-800 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>Map</button>
          </div>
          {locationStatus && <p className="mt-3 text-sm text-slate-500" role="status">{locationStatus}</p>}
        </div>
      </div>

      {/* Property Cards */}
      <div className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading properties">
            {[0,1,2].map(item => <div key={item} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="h-36 animate-pulse bg-slate-200"/><div className="space-y-3 p-4"><div className="h-5 w-2/3 animate-pulse rounded bg-slate-200"/><div className="h-4 w-1/2 animate-pulse rounded bg-slate-100"/><div className="h-10 animate-pulse rounded-xl bg-slate-200"/></div></div>)}
          </div>
        ) : loadError ? (
          <div className="text-center py-20"><p className="text-red-600 mb-4">{loadError}</p><button onClick={loadProperties} className="btn-primary">Try again</button></div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500">No currently occupied hostels are available to browse. Please check again soon.</p>
          </div>
        ) : view === 'map' ? (
          <NearbyHostelMap properties={filteredProperties} userLocation={userLocation} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProperties.map((property, index) => (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-150 hover:shadow-lg"
              >
                {/* Image */}
                <div className="relative h-36 bg-slate-100 sm:h-40">
                  {property.firstPhoto ? (
                    <img
                      src={property.firstPhoto}
                      alt={property.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-bold text-gray-400">
                      HostelSet
                    </div>
                  )}
                  {property.lowestRent && (
                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold text-slate-800">
                      From {formatCurrency(property.lowestRent)}/mo
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-4">
                  <h3 className="text-xl font-bold text-slate-800 mb-1">{property.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">{property.city || 'Location not specified'}</p>
                  {property.distance != null && <p className="mb-3 text-sm font-semibold text-blue-700">{property.distance < 1 ? `${Math.round(property.distance * 1000)} m away` : `${property.distance.toFixed(1)} km away`}</p>}
                  <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
                    <span>{property.totalRooms} rooms</span>
                    <span>{property.activeTenantCount} active tenant{property.activeTenantCount === 1 ? '' : 's'}</span>
                  </div>
                  <p className={`mb-3 text-xs font-bold ${property.availableRooms > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{property.availableRooms > 0 ? `${property.availableRooms} room${property.availableRooms === 1 ? '' : 's'} with availability` : 'Currently full'}</p>
                  <Link
                    href={propertyPublicPath(property)}
                    className="block w-full rounded-xl bg-orange-600 py-2.5 text-center font-bold text-white transition hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
                  >
                    View Details →
                  </Link>
                  {Number.isFinite(property.latitude) && Number.isFinite(property.longitude) && <a href={`https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`} target="_blank" rel="noreferrer" className="mt-2 block w-full rounded-full border border-slate-300 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">Get Directions</a>}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <PublicFooter />
      </div>
    </>
  )
}
