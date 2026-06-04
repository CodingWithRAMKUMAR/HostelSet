import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function CompleteRegistration() {
  const router = useRouter()
  const { email } = router.query
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    phone: '',
    full_name: '',
    role: 'tenant'
  })
  
  // Redirect if no email
  useEffect(() => {
    if (router.isReady && !email) {
      router.push('/login')
    }
  }, [router.isReady, email, router])
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.phone || formData.phone.length !== 10) {
      toast.error('Enter valid 10-digit phone number')
      return
    }
    
    if (!formData.full_name) {
      toast.error('Enter your full name')
      return
    }
    
    setLoading(true)
    
    try {
      // Check if user already exists with this phone
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('phone', formData.phone)
        .maybeSingle()
      
      if (existingUser) {
        toast.error('Phone number already registered. Please login.')
        router.push('/login')
        return
      }
      
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: email,
          phone: formData.phone,
          full_name: formData.full_name,
          role: formData.role,
          is_active: true
        })
        .select()
        .single()
      
      if (createError) throw createError
      
      // Store in localStorage
      localStorage.setItem('userId', newUser.id)
      localStorage.setItem('userRole', newUser.role)
      localStorage.setItem('isLoggedIn', 'true')
      localStorage.setItem('userEmail', email)
      localStorage.setItem('userPhone', formData.phone)
      localStorage.setItem('userName', formData.full_name)
      
      toast.success('Account created successfully!')
      
      // Redirect based on role
      if (newUser.role === 'owner') {
        router.push('/owner/register-property')
      } else {
        router.push('/tenant/waiting')
      }
      
    } catch (error) {
      console.error('Registration error:', error)
      toast.error('Failed to create account. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-gray-100"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-slate-700 to-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <span className="text-3xl">🏠</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Complete Registration</h1>
          <p className="text-gray-500 mt-1">Welcome! Please complete your profile</p>
          <p className="text-sm text-gray-400 mt-2">Email: {email}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Full Name *</label>
            <input
              type="text"
              placeholder="Enter your full name"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800 transition"
              value={formData.full_name}
              onChange={(e) => setFormData({...formData, full_name: e.target.value})}
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-700 font-semibold mb-2">Phone Number *</label>
            <div className="flex gap-2">
              <span className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 text-gray-600">+91</span>
              <input
                type="tel"
                placeholder="9876543210"
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800 transition"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                maxLength={10}
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-gray-700 font-semibold mb-2">I am a</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({...formData, role: 'owner'})}
                className={`p-3 rounded-xl border-2 transition-all ${
                  formData.role === 'owner'
                    ? 'border-slate-800 bg-slate-50 text-slate-800'
                    : 'border-gray-200 text-gray-500 hover:border-slate-300'
                }`}
              >
                🏢 Property Owner
              </button>
              <button
                type="button"
                onClick={() => setFormData({...formData, role: 'tenant'})}
                className={`p-3 rounded-xl border-2 transition-all ${
                  formData.role === 'tenant'
                    ? 'border-slate-800 bg-slate-50 text-slate-800'
                    : 'border-gray-200 text-gray-500 hover:border-slate-300'
                }`}
              >
                👤 Tenant
              </button>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Complete Registration →'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
