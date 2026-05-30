import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function Register() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    propertyName: '', ownerName: '', phone: '', email: '',
    address: '', city: '', pincode: '', propertyType: 'boys', totalRooms: ''
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('phone', `+91${formData.phone}`)
        .single()

      let userId
      if (existingUser) {
        userId = existingUser.id
      } else {
        // Create new user
        const { data: newUser, error } = await supabase
          .from('users')
          .insert({
            phone: `+91${formData.phone}`,
            email: formData.email,
            full_name: formData.ownerName,
            role: 'owner'
          })
          .select()
          .single()
        
        if (error) throw error
        userId = newUser.id
      }

      // Create property
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .insert({
          owner_id: userId,
          name: formData.propertyName,
          address: formData.address,
          city: formData.city,
          pincode: formData.pincode,
          property_type: formData.propertyType,
          total_rooms: parseInt(formData.totalRooms) || 0
        })
        .select()
        .single()

      if (propertyError) throw propertyError

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
      
      if (rooms.length > 0) {
        const { error: roomsError } = await supabase.from('rooms').insert(rooms)
        if (roomsError) throw roomsError
      }

      toast.success('Property registered successfully! Please login.')
      router.push('/login')
    } catch (error) {
      toast.error('Registration failed. Please try again.')
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
            <p className="text-white/80 mt-1">Join India's fastest-growing PG network</p>
          </div>

          <div className="p-8">
            {/* Progress Steps */}
            <div className="flex justify-between mb-8">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex-1 text-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto font-bold transition-all ${
                    step >= s ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {s}
                  </div>
                  <p className="text-xs mt-2 text-gray-500">
                    {s === 1 ? 'Property' : s === 2 ? 'Owner' : 'Rooms'}
                  </p>
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                  <input name="propertyName" placeholder="Property Name" className="input" onChange={handleChange} required />
                  <input name="address" placeholder="Full Address" className="input" onChange={handleChange} required />
                  <div className="grid grid-cols-2 gap-4">
                    <input name="city" placeholder="City" className="input" onChange={handleChange} required />
                    <input name="pincode" placeholder="Pincode" className="input" onChange={handleChange} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <select name="propertyType" className="input" onChange={handleChange}>
                      <option value="boys">Boys PG</option>
                      <option value="girls">Girls PG</option>
                      <option value="co-ed">Co-ed PG</option>
                    </select>
                    <input name="totalRooms" type="number" placeholder="Total Rooms" className="input" onChange={handleChange} required />
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <input name="ownerName" placeholder="Owner Name" className="input" onChange={handleChange} required />
                  <div className="flex gap-2">
                    <span className="bg-gray-100 px-4 py-3 rounded-xl border">+91</span>
                    <input name="phone" placeholder="9876543210" className="input flex-1" onChange={handleChange} required />
                  </div>
                  <input name="email" type="email" placeholder="Email" className="input" onChange={handleChange} required />
                </motion.div>
              )}

              {step === 3 && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                  <div className="bg-primary/10 rounded-xl p-4">
                    <h3 className="font-semibold text-primary mb-2">✨ Benefits of registering</h3>
                    <ul className="space-y-2 text-sm">
                      <li>✓ Free listing for 30 days</li>
                      <li>✓ Priority support</li>
                      <li>✓ Verified badge after KYC</li>
                      <li>✓ Access to tenant applications</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600">Summary:</p>
                    <p className="font-semibold mt-2">{formData.propertyName || 'Property Name'}</p>
                    <p className="text-sm text-gray-500">{formData.city || 'City'} - {formData.totalRooms || '0'} rooms</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-4 mt-8">
              {step > 1 && (
                <button onClick={() => setStep(step - 1)} className="flex-1 border-2 border-primary text-primary py-3 rounded-xl font-semibold hover:bg-primary hover:text-white transition">
                  ← Back
                </button>
              )}
              {step < 3 ? (
                <button onClick={() => setStep(step + 1)} className="flex-1 gradient-bg text-white py-3 rounded-xl font-semibold hover:shadow-lg transition">
                  Continue →
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={loading} className="flex-1 gradient-bg text-white py-3 rounded-xl font-semibold hover:shadow-lg disabled:opacity-50">
                  {loading ? 'Registering...' : 'Complete Registration →'}
                </button>
              )}
            </div>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-primary hover:underline">
                Already have an account? Login
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
