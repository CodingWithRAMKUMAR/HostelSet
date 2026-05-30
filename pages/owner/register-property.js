import { useState } from 'react'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function RegisterProperty() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    pincode: '',
    propertyType: 'boys'
  })
  const [rooms, setRooms] = useState([
    { room_number: '101', sharing_type: 'double', monthly_rent: 10000 },
    { room_number: '102', sharing_type: 'double', monthly_rent: 10000 },
    { room_number: '103', sharing_type: 'single', monthly_rent: 15000 },
    { room_number: '104', sharing_type: 'single', monthly_rent: 15000 },
  ])

  const sharingTypes = [
    { value: 'single', label: 'Single Sharing', capacity: 1, icon: '👤', price: 15000, description: 'Private room for 1 person' },
    { value: 'double', label: 'Double Sharing', capacity: 2, icon: '👥', price: 10000, description: 'Shared room for 2 persons' },
    { value: 'triple', label: 'Triple Sharing', capacity: 3, icon: '👥👤', price: 8000, description: 'Shared room for 3 persons' },
    { value: 'four', label: 'Four Sharing', capacity: 4, icon: '👥👥', price: 7000, description: 'Shared room for 4 persons' },
    { value: 'five', label: 'Five Sharing', capacity: 5, icon: '👥👥👤', price: 6000, description: 'Shared room for 5 persons' },
  ]

  const addRoom = () => {
    setRooms([...rooms, { room_number: '', sharing_type: 'double', monthly_rent: 10000 }])
  }

  const removeRoom = (index) => {
    const newRooms = [...rooms]
    newRooms.splice(index, 1)
    setRooms(newRooms)
  }

  const updateRoom = (index, field, value) => {
    const newRooms = [...rooms]
    newRooms[index][field] = value
    if (field === 'sharing_type') {
      const selected = sharingTypes.find(t => t.value === value)
      newRooms[index].monthly_rent = selected?.price || 10000
    }
    setRooms(newRooms)
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const userId = localStorage.getItem('userId')
      
      if (!userId) {
        toast.error('Please login again')
        router.push('/login')
        return
      }

      // 1. Insert property
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .insert({
          owner_id: userId,
          name: formData.name,
          address: formData.address,
          city: formData.city,
          pincode: formData.pincode,
          property_type: formData.propertyType,
          is_approved: true
        })
        .select()
        .single()

      if (propertyError) {
        console.error('Property error:', propertyError)
        throw new Error(propertyError.message)
      }

      // 2. Insert rooms
      for (const room of rooms) {
        if (room.room_number) {
          const selectedType = sharingTypes.find(t => t.value === room.sharing_type)
          const { error: roomError } = await supabase
            .from('rooms')
            .insert({
              property_id: property.id,
              room_number: room.room_number,
              sharing_type: room.sharing_type,
              monthly_rent: room.monthly_rent,
              capacity: selectedType?.capacity || 2,
              current_occupants: 0,
              status: 'vacant'
            })

          if (roomError) {
            console.error('Room error:', roomError)
            // Continue with other rooms even if one fails
          }
        }
      }

      toast.success('Property registered successfully!')
      router.push('/owner/dashboard')
    } catch (error) {
      console.error('Registration error:', error)
      toast.error(error.message || 'Failed to register property. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="gradient-bg p-6 text-white text-center">
            <h1 className="text-2xl font-bold">Register Your Property</h1>
            <p className="text-white/80 mt-1">Set up your PG/Hostel on HOSTELSET</p>
          </div>

          <div className="p-8">
            {/* Progress Steps */}
            <div className="flex justify-between mb-8">
              {[1, 2].map((s) => (
                <div key={s} className="flex-1 text-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto font-bold transition-all ${
                    step >= s ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {s}
                  </div>
                  <p className="text-xs mt-2 text-gray-500">
                    {s === 1 ? 'Property Details' : 'Add Rooms'}
                  </p>
                </div>
              ))}
            </div>

            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Property Name</label>
                  <input
                    type="text"
                    name="name"
                    placeholder="e.g., Sunshine PG"
                    className="input"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Full Address</label>
                  <input
                    type="text"
                    name="address"
                    placeholder="Street, area, landmark"
                    className="input"
                    value={formData.address}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">City</label>
                    <input
                      type="text"
                      name="city"
                      placeholder="Bangalore"
                      className="input"
                      value={formData.city}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">Pincode</label>
                    <input
                      type="text"
                      name="pincode"
                      placeholder="560001"
                      className="input"
                      value={formData.pincode}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Property Type</label>
                  <select
                    name="propertyType"
                    className="input"
                    value={formData.propertyType}
                    onChange={handleChange}
                  >
                    <option value="boys">Boys PG</option>
                    <option value="girls">Girls PG</option>
                    <option value="co-ed">Co-ed PG</option>
                  </select>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-700">Your Rooms</h3>
                  <button
                    type="button"
                    onClick={addRoom}
                    className="text-primary text-sm font-semibold hover:underline"
                  >
                    + Add Room
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {rooms.map((room, index) => (
                    <div key={index} className="border rounded-xl p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-semibold text-gray-700">Room {index + 1}</span>
                        {rooms.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRoom(index)}
                            className="text-red-500 text-sm hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Room Number (e.g., 101)"
                          className="input text-sm"
                          value={room.room_number}
                          onChange={(e) => updateRoom(index, 'room_number', e.target.value)}
                        />
                        <select
                          className="input text-sm"
                          value={room.sharing_type}
                          onChange={(e) => updateRoom(index, 'sharing_type', e.target.value)}
                        >
                          {sharingTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label} {type.icon} - ₹{type.price}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                {rooms.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    No rooms added. Click "Add Room" to add rooms.
                  </div>
                )}

                <div className="bg-primary/10 rounded-xl p-4 mt-4">
                  <p className="text-sm text-primary font-semibold">💡 Tip:</p>
                  <p className="text-xs text-gray-600 mt-1">
                    You can add more rooms later from your dashboard. For now, add at least one room to get started.
                  </p>
                </div>
              </motion.div>
            )}

            <div className="flex gap-4 mt-8">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="flex-1 border-2 border-primary text-primary py-3 rounded-xl font-semibold hover:bg-primary hover:text-white transition"
                >
                  ← Back
                </button>
              )}
              {step < 2 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!formData.name || !formData.address || !formData.city) {
                      toast.error('Please fill all property details')
                      return
                    }
                    setStep(step + 1)
                  }}
                  className="flex-1 gradient-bg text-white py-3 rounded-xl font-semibold hover:shadow-lg transition"
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || rooms.filter(r => r.room_number).length === 0}
                  className="flex-1 gradient-bg text-white py-3 rounded-xl font-semibold hover:shadow-lg disabled:opacity-50 transition"
                >
                  {loading ? 'Registering...' : 'Complete Registration →'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
