import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function Login() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('phone')
  const [role, setRole] = useState('owner')
  const [loading, setLoading] = useState(false)

  const sendOTP = async () => {
    if (phone.length !== 10) {
      toast.error('Enter 10-digit phone number')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: `+91${phone}` })
      if (error) throw error
      toast.success('OTP sent!')
      setStep('otp')
    } catch (error) {
      toast.success('Demo mode: Use OTP 123456')
      setStep('otp')
    }
    setLoading(false)
  }

  const verifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error('Enter 6-digit OTP')
      return
    }
    setLoading(true)
    try {
      if (otp === '123456') {
        // Check if user exists
        const { data: existingUser, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('phone', `+91${phone}`)
          .maybeSingle()
        
        if (existingUser) {
          // User exists - login
          localStorage.setItem('userId', existingUser.id)
          localStorage.setItem('userRole', existingUser.role)
          localStorage.setItem('isLoggedIn', 'true')
          localStorage.setItem('userName', existingUser.full_name)
          toast.success(`Welcome back, ${existingUser.full_name}!`)
          
          // Redirect based on role
          if (existingUser.role === 'owner') {
            // Check if owner has property
            const { data: property } = await supabase
              .from('properties')
              .select('id')
              .eq('owner_id', existingUser.id)
              .maybeSingle()
            
            if (property) {
              router.push('/owner/dashboard')
            } else {
              router.push('/owner/register-property')
            }
          } else {
            // Tenant - check if assigned to room
            const { data: tenant } = await supabase
              .from('tenants')
              .select('id, room_id')
              .eq('user_id', existingUser.id)
              .maybeSingle()
            
            if (tenant && tenant.room_id) {
              router.push('/tenant/dashboard')
            } else {
              toast.success('No room assigned yet. Contact your PG owner.')
              router.push('/tenant/waiting')
            }
          }
        } else {
          // New user - create account
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({ phone: `+91${phone}`, full_name: `User_${phone.slice(-4)}`, role: role })
            .select()
            .single()
          
          if (createError) throw createError
          
          localStorage.setItem('userId', newUser.id)
          localStorage.setItem('userRole', role)
          localStorage.setItem('isLoggedIn', 'true')
          localStorage.setItem('userName', newUser.full_name)
          toast.success('Account created successfully!')
          
          if (role === 'owner') {
            router.push('/owner/register-property')
          } else {
            toast.info('Please wait for owner to assign you a room')
            router.push('/tenant/waiting')
          }
        }
      } else {
        const { error } = await supabase.auth.verifyOtp({ phone: `+91${phone}`, token: otp, type: 'sms' })
        if (error) throw error
      }
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Invalid OTP. Use 123456 for demo')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-white to-secondary/20 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-20 h-20 bg-gradient-to-r from-primary to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
          >
            <span className="text-4xl">🏠</span>
          </motion.div>
          <h1 className="text-3xl font-bold text-primary">HOSTELSET</h1>
          <p className="text-gray-500 mt-2">Login to your account</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'phone' ? (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div>
                <label className="block text-gray-700 font-semibold mb-2">I am a</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setRole('owner')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      role === 'owner'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 text-gray-500 hover:border-primary/50'
                    }`}
                  >
                    <div className="text-2xl mb-1">🏢</div>
                    <div className="font-semibold">Property Owner</div>
                  </button>
                  <button
                    onClick={() => setRole('tenant')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      role === 'tenant'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 text-gray-500 hover:border-primary/50'
                    }`}
                  >
                    <div className="text-2xl mb-1">👤</div>
                    <div className="font-semibold">Tenant</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">Phone Number</label>
                <div className="flex gap-2">
                  <span className="bg-gray-100 px-4 py-3 rounded-xl border border-gray-200">+91</span>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary transition-all"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={10}
                  />
                </div>
              </div>

              <button
                onClick={sendOTP}
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary to-orange-500 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Continue →'}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Enter OTP</label>
                <input
                  type="text"
                  placeholder="123456"
                  className="w-full px-4 py-3 text-center text-2xl tracking-widest border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary transition-all"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                />
                <p className="text-sm text-gray-500 mt-2">OTP sent to +91 {phone}</p>
              </div>

              <button
                onClick={verifyOTP}
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary to-orange-500 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Login →'}
              </button>

              <button
                onClick={() => setStep('phone')}
                className="w-full text-primary hover:underline text-sm"
              >
                ← Change phone number
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 text-center">
          <Link href="/register" className="text-primary hover:underline">
            New User? Register your property →
          </Link>
        </div>

        <div className="mt-4 text-center text-xs text-gray-400">
          Demo: Any phone number | OTP: 123456
        </div>
      </motion.div>
    </div>
  )
}
