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
    <div className="min-h-screen py-12 bg-gradient-to-br from-gray-50 to-white">
      <div className="container mx-auto max-w-3xl px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-8 py-6">
            <h1 className="text-2xl font-bold text-white">🏠 Register Your Property</h1>
            <p className="text-slate-300 text-sm mt-1">Join India's fastest-growing PG network</p>
          </div>

          <div className="p-8">
            <div className="flex justify-between mb-8">
              {[1, 2, 3, 4, 5].map(s => (
                <div key={s} className="flex-1 text-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto transition-all ${step >= s ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-400'}`}>{s}</div>
                  <p className="text-xs mt-2 text-gray-500">{s === 1 ? 'Property' : s === 2 ? 'Owner' : s === 3 ? 'Amenities' : s === 4 ? 'Photos' : 'Submit'}</p>
                </div>
              ))}
            </div>

            {step === 1 && (<div className="space-y-4"><input name="name" placeholder="Property Name *" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" onChange={handleChange} required /><textarea name="description" placeholder="Property Description" rows="3" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" onChange={handleChange} /><input name="address" placeholder="Full Address *" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" onChange={handleChange} required /><div className="grid grid-cols-2 gap-4"><input name="city" placeholder="City *" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" onChange={handleChange} required /><input name="pincode" placeholder="Pincode" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" onChange={handleChange} /></div><select name="propertyType" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" onChange={handleChange}><option value="boys">Boys PG</option><option value="girls">Girls PG</option><option value="co-ed">Co-ed PG</option><option value="professionals">Working Professionals</option></select><input name="totalRooms" type="number" placeholder="Total Rooms *" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" onChange={handleChange} required /></div>)}

            {step === 2 && (<div className="space-y-4"><input name="ownerName" placeholder="Owner Name *" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" onChange={handleChange} required /><div className="flex gap-2"><span className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200">+91</span><input name="phone" placeholder="Phone Number *" className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" onChange={handleChange} required /></div><input name="email" type="email" placeholder="Email *" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" onChange={handleChange} required /></div>)}

            {step === 3 && (<div><label className="block text-gray-700 mb-3">Select Amenities</label><div className="grid grid-cols-2 gap-3">{amenitiesList.map(amenity => (<button key={amenity} type="button" onClick={() => toggleAmenity(amenity)} className={`p-3 rounded-xl border-2 transition-all ${formData.amenities.includes(amenity) ? 'border-slate-800 bg-slate-50 text-slate-800' : 'border-gray-200 text-gray-500 hover:border-slate-300'}`}>{amenity}</button>))}</div></div>)}

            {step === 4 && (<div><label className="block text-gray-700 mb-3">Upload Property Photos</label><div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">{propertyImages.map((img, i) => (<div key={i} className="relative group"><img src={img} alt={`Property ${i + 1}`} className="w-full h-24 object-cover rounded-lg" /><button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 text-sm opacity-0 group-hover:opacity-100 transition">✕</button></div>))}<label className="border-2 border-dashed border-gray-300 rounded-lg h-24 flex items-center justify-center cursor-pointer hover:border-slate-400 transition"><div className="text-center"><div className="text-2xl mb-1">📷</div><div className="text-xs text-gray-400">Add Photo</div></div><input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploadingImages} /></label></div>{uploadingImages && <div className="text-center text-slate-600 text-sm mt-2">Uploading...</div>}<p className="text-xs text-gray-400 mt-2">Upload photos of rooms, amenities, and property exterior</p></div>)}

            {step === 5 && (<div className="bg-slate-50 rounded-xl p-6"><p className="text-slate-800 text-lg mb-4 text-center font-semibold">✨ Review Your Details</p><div className="grid md:grid-cols-2 gap-4 text-sm"><div><p className="text-gray-500">Property Name:</p><p className="font-semibold text-slate-700">{formData.name || 'Not entered'}</p></div><div><p className="text-gray-500">Location:</p><p className="font-semibold text-slate-700">{formData.city || 'Not entered'}</p></div><div><p className="text-gray-500">Property Type:</p><p className="font-semibold text-slate-700">{formData.propertyType}</p></div><div><p className="text-gray-500">Total Rooms:</p><p className="font-semibold text-slate-700">{formData.totalRooms || 'Not entered'}</p></div><div><p className="text-gray-500">Amenities:</p><p className="font-semibold text-slate-700">{formData.amenities.length} selected</p></div><div><p className="text-gray-500">Owner:</p><p className="font-semibold text-slate-700">{formData.ownerName || 'Not entered'}</p></div><div><p className="text-gray-500">Phone:</p><p className="font-semibold text-slate-700">{formData.phone || 'Not entered'}</p></div><div><p className="text-gray-500">Email:</p><p className="font-semibold text-slate-700">{formData.email || 'Not entered'}</p></div><div className="md:col-span-2"><p className="text-gray-500">Photos:</p><p className="font-semibold text-slate-700">{propertyImages.length} image(s) uploaded</p></div></div><p className="text-gray-400 text-sm text-center mt-4">Click Complete Registration to finish</p></div>)}

            <div className="flex gap-4 mt-8">{step > 1 && (<button onClick={() => setStep(step - 1)} className="flex-1 border-2 border-slate-300 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 transition">← Back</button>)}{step < 5 ? (<button onClick={() => setStep(step + 1)} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition">Continue →</button>) : (<button onClick={handleSubmit} disabled={loading} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 disabled:opacity-50 transition">{loading ? 'Registering...' : 'Complete Registration →'}</button>)}</div>

            <div className="mt-6 text-center"><Link href="/login" className="text-slate-600 hover:text-slate-800 text-sm">Already have an account? Login</Link></div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
