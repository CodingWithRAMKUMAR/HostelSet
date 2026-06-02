import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function RegisterProperty() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ name: '', address: '', city: '', pincode: '', propertyType: 'boys', description: '', amenities: [] })
  const [step, setStep] = useState(1)

  const amenitiesList = ['WiFi', 'AC', 'Parking', 'Food', 'Gym', 'Laundry', 'Security', 'Study Room', 'TV', 'Water Filter']

  const toggleAmenity = (amenity) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const userId = localStorage.getItem('userId')
      const { error } = await supabase.from('properties').insert({
        owner_id: userId,
        name: formData.name,
        address: formData.address,
        city: formData.city,
        pincode: formData.pincode,
        property_type: formData.propertyType,
        description: formData.description,
        amenities: formData.amenities,
        is_active: true
      })
      if (error) throw error
      toast.success('Property registered successfully!')
      router.push('/owner/dashboard')
    } catch (error) {
      toast.error('Failed to register property')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8" style={{ background: '#0f172a' }}>
      <div className="container mx-auto max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-secondary rounded-2xl p-8 border border-gray-800">
          <div className="text-center mb-8"><h1 className="text-2xl font-bold text-primary">🏠 HOSTELSET</h1><p className="text-gray-400 mt-2">Register Your Property</p></div>
          <div className="flex justify-between mb-8">{ [1,2,3].map(s => <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= s ? 'bg-primary text-white' : 'bg-dark text-gray-500'}`}>{s}</div>)}</div>
          
          {step === 1 && (
            <div className="space-y-4">
              <input name="name" placeholder="Property Name" className="input" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              <textarea placeholder="Description" rows="3" className="input" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              <input name="address" placeholder="Full Address" className="input" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input name="city" placeholder="City" className="input" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} />
                <input name="pincode" placeholder="Pincode" className="input" value={formData.pincode} onChange={(e) => setFormData({...formData, pincode: e.target.value})} />
              </div>
              <select className="input" value={formData.propertyType} onChange={(e) => setFormData({...formData, propertyType: e.target.value})}>
                <option value="boys">Boys PG</option><option value="girls">Girls PG</option><option value="co-ed">Co-ed PG</option><option value="professionals">Working Professionals</option>
              </select>
            </div>
          )}
          
          {step === 2 && (
            <div>
              <label className="block text-gray-300 mb-3">Select Amenities</label>
              <div className="grid grid-cols-2 gap-3">
                {amenitiesList.map(amenity => (
                  <button key={amenity} type="button" onClick={() => toggleAmenity(amenity)} className={`p-3 rounded-xl border-2 transition-all ${formData.amenities.includes(amenity) ? 'border-primary bg-primary/10 text-primary' : 'border-gray-700 text-gray-400'}`}>{amenity}</button>
                ))}
              </div>
            </div>
          )}
          
          {step === 3 && (
            <div className="bg-primary/10 rounded-xl p-6 text-center">
              <p className="text-primary text-lg mb-2">✨ You're almost done!</p>
              <p className="text-gray-400 text-sm">Review your details and click Complete to finish registration.</p>
              <div className="mt-4 text-left text-sm text-gray-300">
                <p><strong>Property:</strong> {formData.name}</p>
                <p><strong>Location:</strong> {formData.city}</p>
                <p><strong>Type:</strong> {formData.propertyType}</p>
                <p><strong>Amenities:</strong> {formData.amenities.length} selected</p>
              </div>
            </div>
          )}
          
          <div className="flex gap-4 mt-8">
            {step > 1 && <button onClick={() => setStep(step-1)} className="btn-outline flex-1">Back</button>}
            {step < 3 ? <button onClick={() => setStep(step+1)} className="btn-primary flex-1">Continue</button> : <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1">{loading ? 'Processing...' : 'Complete Registration'}</button>}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
