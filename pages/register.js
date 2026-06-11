import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase, signUpWithEmail } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function Register() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '', ownerName: '', phone: '', email: '', password: '', confirmPassword: '',
    address: '', city: '', propertyType: 'boys'
  })

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      setLoading(false)
      return
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      setLoading(false)
      return
    }
    const cleanPhone = formData.phone
    if (cleanPhone.length !== 10) {
      toast.error('Enter valid 10-digit phone number')
      setLoading(false)
      return
    }

    try {
      const signUpResult = await signUpWithEmail(formData.email, formData.password, {
        full_name: formData.ownerName,
        phone: cleanPhone,
        role: 'owner'
      })
      if (!signUpResult.success) throw new Error(signUpResult.error)

      const userId = signUpResult.user.id

      const { error: propertyError } = await supabase.from('properties').insert({
        owner_id: userId, name: formData.name, address: formData.address,
        city: formData.city, property_type: formData.propertyType, is_active: true
      })
      if (propertyError) throw propertyError

      toast.success('Registration successful! Please login.')
      router.push('/login')
    } catch (error) {
      console.error(error)
      toast.error(error.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen py-12 bg-gradient-to-br from-gray-50 to-white">
      <div className="container mx-auto max-w-2xl px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-8 py-6">
            <h1 className="text-2xl font-bold text-white">🏠 Register Your Property</h1>
            <p className="text-slate-300 text-sm mt-1">Join India's fastest-growing PG network</p>
          </div>
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-gray-700 font-semibold mb-2">Property Name *</label><input type="text" name="name" placeholder="e.g., Sunshine PG" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.name} onChange={handleChange} required /></div>
                <div><label className="block text-gray-700 font-semibold mb-2">Owner Name *</label><input type="text" name="ownerName" placeholder="Full name" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.ownerName} onChange={handleChange} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-gray-700 font-semibold mb-2">Phone Number *</label><div className="flex gap-2"><span className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200">+91</span><input type="tel" name="phone" placeholder="9876543210" className="flex-1 px-4 py-3 border border-gray-200 rounded-xl" value={formData.phone} onChange={handleChange} maxLength={10} required /></div></div>
                <div><label className="block text-gray-700 font-semibold mb-2">Email Address *</label><input type="email" name="email" placeholder="owner@example.com" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.email} onChange={handleChange} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-gray-700 font-semibold mb-2">Password *</label><input type="password" name="password" placeholder="••••••••" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.password} onChange={handleChange} required /></div>
                <div><label className="block text-gray-700 font-semibold mb-2">Confirm Password *</label><input type="password" name="confirmPassword" placeholder="••••••••" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.confirmPassword} onChange={handleChange} required /></div>
              </div>
              <div><label className="block text-gray-700 font-semibold mb-2">Full Address *</label><input type="text" name="address" placeholder="Street, area, landmark" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.address} onChange={handleChange} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-gray-700 font-semibold mb-2">City *</label><input type="text" name="city" placeholder="Bangalore" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.city} onChange={handleChange} required /></div>
                <div><label className="block text-gray-700 font-semibold mb-2">Property Type</label><select name="propertyType" className="w-full px-4 py-3 border border-gray-200 rounded-xl" value={formData.propertyType} onChange={handleChange}><option value="boys">Boys PG</option><option value="girls">Girls PG</option><option value="co-ed">Co-ed PG</option><option value="professionals">Working Professionals</option></select></div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50 mt-4">{loading ? 'Registering...' : 'Register Property →'}</button>
            </form>
            <div className="mt-6 text-center"><Link href="/login" className="text-slate-600 hover:text-slate-800 text-sm">Already have an account? Login</Link></div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
