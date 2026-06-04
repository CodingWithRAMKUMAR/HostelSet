import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/utils';
import Image from 'next/image';
import Link from 'next/link';

export default function PropertyDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [property, setProperty] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [applicationData, setApplicationData] = useState({
    name: '',
    phone: '',
    email: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPropertyData();
    }
  }, [id]);

  async function fetchPropertyData() {
    try {
      // Fetch property details
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single();

      if (propertyError) throw propertyError;
      setProperty(propertyData);

      // Fetch rooms with availability
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select(`
          *,
          tenants:tenants(count)
        `)
        .eq('property_id', id);

      if (roomsError) throw roomsError;
      
      // Calculate availability for each room
      const roomsWithAvailability = roomsData.map(room => ({
        ...room,
        occupiedCount: room.tenants[0]?.count || 0,
        available: (room.capacity || room.sharing_type === 'Single' ? 1 : 
                   room.sharing_type === 'Double' ? 2 :
                   room.sharing_type === 'Triple' ? 3 :
                   room.sharing_type === 'Four' ? 4 : 5) - (room.tenants[0]?.count || 0)
      }));
      
      setRooms(roomsWithAvailability);
    } catch (error) {
      console.error('Error fetching property:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(room) {
    setSelectedRoom(room);
    setShowApplyModal(true);
  }

  async function submitApplication() {
    if (!applicationData.name || !applicationData.phone) {
      alert('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('applications')
        .insert([{
          property_id: parseInt(id),
          room_id: selectedRoom.id,
          applicant_name: applicationData.name,
          applicant_phone: applicationData.phone,
          applicant_email: applicationData.email,
          message: applicationData.message,
          status: 'pending',
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      alert('Application submitted successfully! The owner will contact you soon.');
      setShowApplyModal(false);
      setApplicationData({ name: '', phone: '', email: '', message: '' });
    } catch (error) {
      console.error('Error submitting application:', error);
      alert('Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-white mt-4">Loading property details...</p>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Property not found</h2>
          <Link href="/" className="text-purple-400 hover:text-purple-300">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              HostelSet
            </Link>
            <Link href="/login" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition">
              Login
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Property Header */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl overflow-hidden border border-white/10 mb-8">
          {/* Image Gallery */}
          <div className="relative h-96 bg-black/30">
            {property.photos && property.photos.length > 0 && (
              <Image
                src={property.photos[selectedImage]}
                alt={property.name}
                fill
                className="object-cover"
              />
            )}
            
            {/* Image Navigation */}
            {property.photos && property.photos.length > 1 && (
              <>
                <button
                  onClick={() => setSelectedImage((prev) => (prev > 0 ? prev - 1 : property.photos.length - 1))}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition"
                >
                  ←
                </button>
                <button
                  onClick={() => setSelectedImage((prev) => (prev < property.photos.length - 1 ? prev + 1 : 0))}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition"
                >
                  →
                </button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {property.photos && property.photos.length > 1 && (
            <div className="flex gap-2 p-4 overflow-x-auto">
              {property.photos.map((photo, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 transition ${
                    selectedImage === idx ? 'border-purple-500' : 'border-transparent'
                  }`}
                >
                  <Image src={photo} alt={`Thumbnail ${idx + 1}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Property Info */}
          <div className="p-6">
            <h1 className="text-3xl font-bold text-white mb-2">{property.name}</h1>
            <p className="text-gray-300 mb-4">{property.city}</p>
            <div className="flex gap-2 mb-4">
              <span className="px-3 py-1 bg-purple-600/20 text-purple-300 rounded-full text-sm">
                {property.property_type || 'Co-ed'}
              </span>
              {property.amenities && property.amenities.map((amenity, idx) => (
                <span key={idx} className="px-3 py-1 bg-white/10 text-gray-300 rounded-full text-sm">
                  {amenity}
                </span>
              ))}
            </div>
            <p className="text-gray-300">{property.description}</p>
          </div>
        </div>

        {/* Rooms Section */}
        <h2 className="text-2xl font-bold text-white mb-6">Available Rooms</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 hover:border-purple-500/50 transition"
            >
              <h3 className="text-xl font-semibold text-white mb-2">
                Room {room.room_number}
              </h3>
              <p className="text-gray-300 mb-2">
                Type: {room.sharing_type} Sharing
              </p>
              <p className="text-2xl font-bold text-purple-400 mb-2">
                {formatCurrency(room.rent)}/month
              </p>
              <p className="text-sm text-gray-400 mb-4">
                Available: {room.available} / {room.sharing_type === 'Single' ? 1 :
                          room.sharing_type === 'Double' ? 2 :
                          room.sharing_type === 'Triple' ? 3 :
                          room.sharing_type === 'Four' ? 4 : 5} seats
              </p>
              <button
                onClick={() => handleApply(room)}
                disabled={room.available === 0}
                className={`w-full py-2 rounded-lg transition ${
                  room.available > 0
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-gray-600 cursor-not-allowed text-gray-300'
                }`}
              >
                {room.available > 0 ? 'Apply Now' : 'Fully Booked'}
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Application Modal */}
      <AnimatePresence>
        {showApplyModal && selectedRoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowApplyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-slate-800 to-purple-900 rounded-2xl p-6 max-w-md w-full border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-white mb-4">Apply for Room {selectedRoom.room_number}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-2">Full Name *</label>
                  <input
                    type="text"
                    value={applicationData.name}
                    onChange={(e) => setApplicationData({ ...applicationData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Phone Number *</label>
                  <input
                    type="tel"
                    value={applicationData.phone}
                    onChange={(e) => setApplicationData({ ...applicationData, phone: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Email (Optional)</label>
                  <input
                    type="email"
                    value={applicationData.email}
                    onChange={(e) => setApplicationData({ ...applicationData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2">Message (Optional)</label>
                  <textarea
                    value={applicationData.message}
                    onChange={(e) => setApplicationData({ ...applicationData, message: e.target.value })}
                    rows="3"
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={submitApplication}
                    disabled={submitting}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg transition disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                  <button
                    onClick={() => setShowApplyModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
