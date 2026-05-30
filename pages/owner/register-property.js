import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function RegisterProperty() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '', address: '', city: '', pincode: '', propertyType: 'boys', totalRooms: ''
  })

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    const userRole = localStorage.getItem('userRole')
    if (!isLoggedIn || userRole !== 'owner') {
      router.push('/login')
    }
  }, [])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.address || !formData.city || !formData.totalRooms) {
      toast.error('Please fill all required fields')
      return
    }

    setLoading(true)
    try {
      const userId = localStorage.getItem('userId')
      
      // Create property
      const { data: property, error } = await supabase
        .from('properties')
        .insert({
          owner_id: userId,
          name: formData.name,
          address: formData.address,
          city: formData.city,
          pincode: formData.pincode,
          property_type: formData.propertyType,
          total_rooms: parseInt(formData.totalRooms)
        })
        .select()
        .single()

      if (error) throw error

      // Create rooms
      const rooms = []
      for (let i = 1; i <= parseInt(formData.totalRooms); i++) {
        rooms.push({
          property_id: property.id,
          room_number: (100 + i).toString(),
          monthly_rent: 10000,
          status: 'vacant'
        })
      }
      
      const { error: roomsError } = await supabase.from('rooms').insert(rooms)
      if (roomsError) throw roomsError

      toast.success('Property registered successfully!')
      router.push('/owner/dashboard')
    } catch (error) {
      toast.error('Failed to register property')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-white to-secondary/20 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="gradient-bg p-6 text-white text-center">
            <h1 className="text-2xl font-bold">Register Your Property</h1>
            <p className="text-white/80 mt-1">List your property on HOSTELSET</p>
          </div>

          <div className="p-8 space-y-6">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Property Name *</label>
              <input name="name" placeholder="e.g., Sunshine PG" className="input" onChange={handleChange} required />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2">Full Address *</label>
              <input name="address" placeholder="Street, area, landmark" className="input" onChange={handleChange} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">City *</label>
                <input name="city" placeholder="Bangalore" className="input" onChange={handleChange} required />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Pincode</label>
                <input name="pincode" placeholder="560001" className="input" onChange={handleChange} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Property Type</label>
                <select name="propertyType" className="input" onChange={handleChange}>
                  <option value="boys">Boys PG</option>
                  <option value="girls">Girls PG</option>
                  <option value="co-ed">Co-ed PG</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Total Rooms *</label>
                <input name="totalRooms" type="number" placeholder="20" className="input" onChange={handleChange} required />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full gradient-bg text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Register Property →'}
            </button>

            <div className="text-center">
              <Link href="/owner/dashboard" className="text-primary hover:underline">
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
