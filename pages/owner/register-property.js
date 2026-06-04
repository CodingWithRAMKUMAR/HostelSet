import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase, uploadImage } from '../../lib/supabase'
import { cleanPhoneNumber } from '../../lib/utils'
import toast from 'react-hot-toast'

export default function RegisterProperty() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [step, setStep] = useState(1)
  const [propertyImages, setPropertyImages] = useState([])
  const [formData, setFormData] = useState({
    name: '',
    ownerName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    pincode: '',
    propertyType: 'boys',
    totalRooms: '',
    description: '',
    amenities: []
  })

  const amenitiesList = [
    'WiFi', 'AC', 'Parking', 'Food', 'Gym', 'Laundry', 
    'Security', 'Study Room', 'TV', 'Water Filter', 'Geyser', 'Bed', 'Study Table', 'Attached Bathroom'
  ]

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const toggleAmenity = (amenity) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }))
  }

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    
    setUploadingImages(true)
    try {
      const uploadedUrls = []
      for (const file of files) {
        const url = await uploadImage(file, 'temp-property')
        uploadedUrls.push(url)
      }
      setPropertyImages([...propertyImages, ...uploadedUrls])
      toast.success(`${uploadedUrls.length} image(s) uploaded`)
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload images')
    } finally {
      setUploadingImages(false)
    }
  }

  const removeImage = (index) => {
    const newImages = [...propertyImages]
    newImages.splice(index, 1)
    setPropertyImages(newImages)
    toast.success('Image removed')
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const cleanPhone = cleanPhoneNumber(formData.phone)
      
      // Create user
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          phone: cleanPhone,
          email: formData.email,
          full_name: formData.ownerName,
          role: 'owner',
          is_active: true
        })
        .select()
        .single()
      
      if (userError) throw userError

      // Create property with images
      const { error: propertyError } = await supabase
        .from('properties')
        .insert({
          owner_id: newUser.id,
          name: formData.name,
          description: formData.description,
          address: formData.address,
          city: formData.city,
          pincode: formData.pincode,
          property_type: formData.propertyType,
          amenities: formData.amenities,
          photos: propertyImages,
          is_active: true
        })

      if (propertyError) throw propertyError

      toast.success('Property registered successfully! Please login.')
      router.push('/login')
    } catch (error) {
      console.error('Registration error:', error)
      toast.error('Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8" style={{ background: '#0f172a' }}>
      <div className="container mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-secondary rounded-2xl p-8 border border-gray-800"
        >
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-primary">🏠 HOSTELSET</h1>
            <p className="text-gray-400 mt-2">Register Your Property</p>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-between mb-8">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className="flex-1 text-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto ${
                  step >= s ? 'bg-primary text-white' : 'bg-dark text-gray-500'
                }`}>
                  {s}
                </div>
                <p className="text-xs mt-2 text-gray-500">
                  {s === 1 ? 'Property' : s === 2 ? 'Owner' : s === 3 ? 'Amenities' : s === 4 ? 'Photos' : 'Submit'}
                </p>
              </div>
            ))}
          </div>

          {/* Step 1: Property Details */}
          {step === 1 && (
            <div className="space-y-4">
              <input name="name" placeholder="Property Name *" className="input" onChange={handleChange} required />
              <textarea name="description" placeholder="Property Description" rows="3" className="input" onChange={handleChange} />
              <input name="address" placeholder="Full Address *" className="input" onChange={handleChange} required />
              <div className="grid grid-cols-2 gap-4">
                <input name="city" placeholder="City *" className="input" onChange={handleChange} required />
                <input name="pincode" placeholder="Pincode" className="input" onChange={handleChange} />
              </div>
              <select name="propertyType" className="input" onChange={handleChange}>
                <option value="boys">Boys PG</option>
                <option value="girls">Girls PG</option>
                <option value="co-ed">Co-ed PG</option>
                <option value="professionals">Working Professionals</option>
              </select>
              <input name="totalRooms" type="number" placeholder="Total Rooms *" className="input" onChange={handleChange} required />
            </div>
          )}

          {/* Step 2: Owner Details */}
          {step === 2 && (
            <div className="space-y-4">
              <input name="ownerName" placeholder="Owner Name *" className="input" onChange={handleChange} required />
              <div className="flex gap-2">
                <span className="bg-dark px-4 py-3 rounded-xl border border-gray-700">+91</span>
                <input name="phone" placeholder="Phone Number *" className="input flex-1" onChange={handleChange} required />
              </div>
              <input name="email" type="email" placeholder="Email *" className="input" onChange={handleChange} required />
            </div>
          )}

          {/* Step 3: Amenities */}
          {step === 3 && (
            <div>
              <label className="block text-gray-300 mb-3">Select Amenities</label>
              <div className="grid grid-cols-2 gap-3">
                {amenitiesList.map(amenity => (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => toggleAmenity(amenity)}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      formData.amenities.includes(amenity)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-700 text-gray-400 hover:border-primary/50'
                    }`}
                  >
                    {amenity}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Upload Photos */}
          {step === 4 && (
            <div>
              <label className="block text-gray-300 mb-3">Upload Property Photos</label>
              <div className="image-gallery mb-4">
                {propertyImages.map((img, i) => (
                  <div key={i} className="image-preview group">
                    <img src={img} alt={`Property ${i + 1}`} className="w-full h-24 object-cover rounded-lg" />
                    <button onClick={() => removeImage(i)} className="remove-image opacity-0 group-hover:opacity-100 transition">✕</button>
                  </div>
                ))}
                <label className="image-preview flex items-center justify-center border-2 border-dashed border-gray-600 hover:border-primary cursor-pointer transition">
                  <div className="text-center">
                    <div className="text-2xl mb-1">📷</div>
                    <div className="text-xs text-gray-400">Add Photos</div>
                  </div>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploadingImages} />
                </label>
              </div>
              {uploadingImages && <div className="text-center text-primary text-sm">Uploading...</div>}
              <p className="text-xs text-gray-500 mt-2">Upload photos of rooms, amenities, and property exterior</p>
            </div>
          )}

          {/* Step 5: Summary */}
          {step === 5 && (
            <div className="bg-primary/10 rounded-xl p-6">
              <p className="text-primary text-lg mb-4 text-center">✨ Review Your Details</p>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-400">Property Name:</p><p className="font-semibold">{formData.name || 'Not entered'}</p></div>
                <div><p className="text-gray-400">Location:</p><p className="font-semibold">{formData.city || 'Not entered'}</p></div>
                <div><p className="text-gray-400">Property Type:</p><p className="font-semibold">{formData.propertyType}</p></div>
                <div><p className="text-gray-400">Total Rooms:</p><p className="font-semibold">{formData.totalRooms || 'Not entered'}</p></div>
                <div><p className="text-gray-400">Amenities:</p><p className="font-semibold">{formData.amenities.length} selected</p></div>
                <div><p className="text-gray-400">Owner:</p><p className="font-semibold">{formData.ownerName || 'Not entered'}</p></div>
                <div><p className="text-gray-400">Phone:</p><p className="font-semibold">{formData.phone || 'Not entered'}</p></div>
                <div><p className="text-gray-400">Email:</p><p className="font-semibold">{formData.email || 'Not entered'}</p></div>
                <div className="md:col-span-2"><p className="text-gray-400">Photos:</p><p className="font-semibold">{propertyImages.length} image(s) uploaded</p></div>
              </div>
              <p className="text-gray-400 text-sm text-center mt-4">Click Complete Registration to finish</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-8">
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} className="btn-outline flex-1">
                ← Back
              </button>
            )}
            {step < 5 ? (
              <button onClick={() => setStep(step + 1)} className="btn-primary flex-1">
                Continue →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
                {loading ? 'Registering...' : 'Complete Registration →'}
              </button>
            )}
          </div>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-primary text-sm hover:underline">
              Already have an account? Login
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
