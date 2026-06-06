import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { formatCurrency, getSharingDetails, getPropertyTypeLabel, cleanPhoneNumber } from '../../lib/utils'
import toast from 'react-hot-toast'

export default function PropertyDetail() {
  const router = useRouter()
  const { id } = router.query
  const [property, setProperty] = useState(null)
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [applyForm, setApplyForm] = useState({ name: '', phone: '', email: '', message: '' })
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [activeTab, setActiveTab] = useState('rooms')

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: propertyData } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single()
      setProperty(propertyData)

      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*')
        .eq('property_id', id)
        .order('room_number')
      setRooms(roomsData || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!applyForm.name || !applyForm.phone) {
      toast.error('Please fill name and phone number')
      return
    }

    const cleanPhone = cleanPhoneNumber(applyForm.phone)
    if (cleanPhone.length !== 10) {
      toast.error('Enter valid 10-digit phone number')
      return
    }

    try {
      const { error } = await supabase.from('applications').insert({
        property_id: id,
        room_id: selectedRoom,
        name: applyForm.name,
        phone: cleanPhone,
        email: applyForm.email,
        message: applyForm.message,
        status: 'pending'
      })
      if (error) throw error
      toast.success('Application submitted! Owner will contact you.')
      setShowApplyModal(false)
      setApplyForm({ name: '', phone: '', email: '', message: '' })
    } catch (error) {
      toast.error('Failed to submit application')
    }
  }

  const nextImage = () => {
    if (property?.photos && currentImageIndex < property.photos.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1)
    }
  }

  const prevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading property details...</p>
        </div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="text-6xl mb-4">🏠</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Property not found</h1>
          <Link href="/" className="text-slate-600 hover:text-slate-800 inline-flex items-center gap-2">
            ← Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🏠</span>
              <span className="text-xl font-bold text-slate-800">HOSTELSET</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-gray-600 hover:text-slate-800">Login</Link>
              <Link href="/owner/register-property" className="bg-slate-800 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-slate-700 transition">
                List Property
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 hover:text-slate-800 mb-6 transition group">
          <span className="group-hover:-translate-x-1 transition">←</span> Back to Search
        </button>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">{property.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-gray-500">
            <span className="flex items-center gap-1">📍 {property.address}, {property.city}</span>
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            <span className="flex items-center gap-1">⭐ {property.rating || '4.8'} ({property.total_reviews || 120} reviews)</span>
          </div>
        </div>

        {/* Image Gallery */}
        <div className="mb-8">
          <div className="relative bg-gray-100 rounded-2xl overflow-hidden">
            {property.photos && property.photos.length > 0 ? (
              <>
                <img src={property.photos[currentImageIndex]} alt={property.name} className="w-full h-[400px] object-cover" />
                {property.photos.length > 1 && (
                  <>
                    <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 p-2 rounded-full shadow-md transition">←</button>
                    <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 p-2 rounded-full shadow-md transition">→</button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                      {property.photos.map((_, i) => (
                        <button key={i} onClick={() => setCurrentImageIndex(i)} className={`w-2 h-2 rounded-full transition ${i === currentImageIndex ? 'bg-white w-4' : 'bg-white/50'}`} />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-[400px] flex items-center justify-center text-8xl bg-gradient-to-br from-slate-100 to-gray-100">🏠</div>
            )}
          </div>
          {property.photos && property.photos.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
              {property.photos.map((photo, i) => (
                <button key={i} onClick={() => setCurrentImageIndex(i)} className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition ${i === currentImageIndex ? 'border-slate-800' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button onClick={() => setActiveTab('rooms')} className={`px-6 py-3 font-semibold transition ${activeTab === 'rooms' ? 'text-slate-800 border-b-2 border-slate-800' : 'text-gray-500 hover:text-slate-600'}`}>🏠 Rooms & Availability</button>
          <button onClick={() => setActiveTab('amenities')} className={`px-6 py-3 font-semibold transition ${activeTab === 'amenities' ? 'text-slate-800 border-b-2 border-slate-800' : 'text-gray-500 hover:text-slate-600'}`}>✨ Amenities</button>
          <button onClick={() => setActiveTab('about')} className={`px-6 py-3 font-semibold transition ${activeTab === 'about' ? 'text-slate-800 border-b-2 border-slate-800' : 'text-gray-500 hover:text-slate-600'}`}>📖 About</button>
        </div>

        {activeTab === 'rooms' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => {
              const sharing = getSharingDetails(room.sharing_type)
              const isAvailable = room.current_occupants < room.capacity
              const availableSlots = room.capacity - room.current_occupants
              return (
                <div key={room.id} className={`bg-white rounded-2xl border-2 p-6 transition-all ${isAvailable ? 'border-green-200 hover:border-green-400' : 'border-gray-200 opacity-70'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-800">Room {room.room_number}</h3>
                      <p className="text-gray-500 text-sm mt-1">{sharing.label} {sharing.icon}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {isAvailable ? `${availableSlots} slot available` : 'Full'}
                    </span>
                  </div>
                  <div className="mb-4">
                    <p className="text-3xl font-bold text-slate-800">{formatCurrency(room.monthly_rent)}</p>
                    <p className="text-gray-400 text-sm">per month</p>
                    <p className="text-gray-400 text-sm mt-1">Deposit: {formatCurrency(room.deposit_amount || 0)}</p>
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Occupancy</span>
                      <span className="text-slate-600">{room.current_occupants}/{room.capacity}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-slate-600 h-2 rounded-full" style={{ width: `${(room.current_occupants / room.capacity) * 100}%` }} />
                    </div>
                  </div>
                  {isAvailable && (
                    <button onClick={() => { setSelectedRoom(room.id); setShowApplyModal(true) }} className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition mt-2">Apply Now →</button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'amenities' && (
          <div className="bg-gray-50 rounded-2xl p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Amenities & Facilities</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {(property.amenities || []).map((amenity, i) => (
                <div key={i} className="flex items-center gap-2 text-gray-700">
                  <span className="text-green-500">✓</span>
                  <span>{amenity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="bg-gray-50 rounded-2xl p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4">About this Property</h2>
            <p className="text-gray-600 leading-relaxed">{property.description || 'No description provided.'}</p>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-slate-800 mb-2">Property Details</h3>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Property Type</span>
                  <span className="text-slate-700">{getPropertyTypeLabel(property.property_type)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Total Rooms</span>
                  <span className="text-slate-700">{rooms.length}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Location</span>
                  <span className="text-slate-700">{property.city}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Listed Since</span>
                  <span className="text-slate-700">{new Date(property.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Application Modal */}
      <AnimatePresence>
        {showApplyModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowApplyModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-800">Apply for Room</h2>
                <button onClick={() => setShowApplyModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
              <div className="space-y-4">
                <input type="text" placeholder="Full Name *" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={applyForm.name} onChange={(e) => setApplyForm({...applyForm, name: e.target.value})} />
                <div className="flex gap-2">
                  <span className="bg-gray-100 px-4 py-3 rounded-xl border border-gray-200 text-gray-600">+91</span>
                  <input type="tel" placeholder="Phone Number *" className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={applyForm.phone} onChange={(e) => setApplyForm({...applyForm, phone: e.target.value})} maxLength={10} />
                </div>
                <input type="email" placeholder="Email (optional)" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={applyForm.email} onChange={(e) => setApplyForm({...applyForm, email: e.target.value})} />
                <textarea placeholder="Any message for the owner?" rows="3" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800 resize-none" value={applyForm.message} onChange={(e) => setApplyForm({...applyForm, message: e.target.value})} />
                <button onClick={handleApply} className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition">Submit Application</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="bg-gray-50 border-t border-gray-100 mt-12 py-8">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>&copy; 2026 HOSTELSET. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
