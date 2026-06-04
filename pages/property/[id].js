import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion } from 'framer-motion'
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Property not found</h1>
          <Link href="/" className="text-primary mt-4 inline-block">← Back to Home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#0f172a' }}>
      <nav className="navbar py-4 px-6 flex justify-between items-center sticky top-0 z-50">
        <Link href="/" className="text-2xl font-bold text-primary">🏠 HOSTELSET</Link>
        <Link href="/login" className="text-gray-300 hover:text-primary">Login</Link>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="text-primary mb-6">← Back to Search</button>

        {/* Image Gallery */}
        {property.photos && property.photos.length > 0 && (
          <div className="card mb-8 overflow-hidden">
            <div className="relative">
              <img 
                src={property.photos[currentImageIndex]} 
                alt={property.name} 
                className="w-full h-96 object-cover rounded-t-2xl"
              />
              {property.photos.length > 1 && (
                <>
                  <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70">←</button>
                  <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70">→</button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {property.photos.map((_, i) => (
                      <button key={i} onClick={() => setCurrentImageIndex(i)} className={`w-2 h-2 rounded-full ${i === currentImageIndex ? 'bg-white' : 'bg-white/50'}`} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Property Info */}
        <div className="card mb-8">
          <h1 className="text-3xl font-bold">{property.name}</h1>
          <p className="text-gray-400 mt-2">📍 {property.address}, {property.city}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="badge-info">{getPropertyTypeLabel(property.property_type)}</span>
            {property.amenities?.slice(0, 5).map((a, i) => (
              <span key={i} className="badge-info">{a}</span>
            ))}
          </div>
          <p className="text-gray-300 mt-4">{property.description}</p>
        </div>

        {/* Room Availability */}
        <h2 className="text-2xl font-bold mb-6">🏠 Available Rooms</h2>
        <div className="room-grid">
          {rooms.map((room) => {
            const sharingDetails = getSharingDetails(room.sharing_type)
            const isAvailable = room.current_occupants < room.capacity
            const availableSlots = room.capacity - room.current_occupants
            
            return (
              <div key={room.id} className={`room-card ${isAvailable ? 'room-card-vacant' : 'room-card-occupied'}`}>
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-bold">Room {room.room_number}</h3>
                  <span className={isAvailable ? 'badge-success' : 'badge-danger'}>
                    {isAvailable ? `${availableSlots} slot(s) available` : 'Full'}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-1">{sharingDetails.label} {sharingDetails.icon}</p>
                <p className="text-2xl font-bold text-primary mt-3">
                  {formatCurrency(room.monthly_rent)}<span className="text-sm text-gray-400">/month</span>
                </p>
                <p className="text-gray-500 text-sm mt-2">Deposit: {formatCurrency(room.deposit_amount || 0)}</p>
                {isAvailable && (
                  <button 
                    onClick={() => { setSelectedRoom(room.id); setShowApplyModal(true) }} 
                    className="btn-primary w-full mt-4 text-sm"
                  >
                    Apply Now →
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Application Modal */}
      <AnimatePresence>
        {showApplyModal && (
          <div className="modal-overlay" onClick={() => setShowApplyModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Apply for Room</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Full Name *" className="input" value={applyForm.name} onChange={(e) => setApplyForm({...applyForm, name: e.target.value})} />
                <div className="flex gap-2">
                  <span className="bg-dark px-4 py-3 rounded-xl border border-gray-700 text-gray-300">+91</span>
                  <input type="tel" placeholder="Phone Number *" className="input flex-1" value={applyForm.phone} onChange={(e) => setApplyForm({...applyForm, phone: e.target.value})} maxLength={10} />
                </div>
                <input type="email" placeholder="Email (optional)" className="input" value={applyForm.email} onChange={(e) => setApplyForm({...applyForm, email: e.target.value})} />
                <textarea placeholder="Any message for the owner?" rows="3" className="input" value={applyForm.message} onChange={(e) => setApplyForm({...applyForm, message: e.target.value})} />
                <div className="flex gap-3 mt-6">
                  <button onClick={handleApply} className="btn-primary flex-1">Submit Application</button>
                  <button onClick={() => setShowApplyModal(false)} className="btn-outline flex-1">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
