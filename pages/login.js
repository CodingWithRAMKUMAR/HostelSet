import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, signInWithEmail, resetPassword } from '../lib/supabase'
import { cleanPhoneNumber } from '../lib/utils'
import toast from 'react-hot-toast'

export default function Login() {
  const router = useRouter()
  
  // Phone OTP state (existing)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('phone')
  const [role, setRole] = useState('owner')
  const [loading, setLoading] = useState(false)
  
  // New email/password state
  const [loginMethod, setLoginMethod] = useState('phone') // 'phone' or 'email'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')

  // ========== EXISTING PHONE OTP FUNCTIONS (unchanged) ==========
  const sendOTP = async () => {
    const cleanPhone = cleanPhoneNumber(phone)
    if (cleanPhone.length !== 10) {
      toast.error('Enter 10-digit phone number')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: `+91${cleanPhone}` })
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
        const cleanPhone = cleanPhoneNumber(phone)
        
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('phone', cleanPhone)
          .maybeSingle()
        
        if (existingUser) {
          localStorage.setItem('userId', existingUser.id)
          localStorage.setItem('userRole', existingUser.role)
          localStorage.setItem('isLoggedIn', 'true')
          localStorage.setItem('userName', existingUser.full_name)
          localStorage.setItem('userPhone', cleanPhone)
          
          toast.success(`Welcome back, ${existingUser.full_name}!`)
          
          if (existingUser.role === 'owner') {
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
            router.push('/tenant/dashboard')
          }
        } else {
          toast.error('User not found. Please register first.')
          setLoading(false)
          return
        }
      } else {
        const { error } = await supabase.auth.verifyOtp({
          phone: `+91${cleanPhoneNumber(phone)}`,
          token: otp,
          type: 'sms'
        })
        if (error) throw error
      }
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Invalid OTP. Use 123456')
    }
    setLoading(false)
  }

  // ========== NEW EMAIL/PASSWORD FUNCTIONS ==========
  const handleEmailLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please enter email and password')
      return
    }
    setLoading(true)
    try {
      const result = await signInWithEmail(email, password)
      if (result.success) {
        toast.success(`Welcome back, ${result.userData.full_name}!`)
        
        if (result.role === 'owner') {
          const { data: property } = await supabase
            .from('properties')
            .select('id')
            .eq('owner_id', result.userData.id)
            .maybeSingle()
          
          if (property) {
            router.push('/owner/dashboard')
          } else {
            router.push('/owner/register-property')
          }
        } else {
          router.push('/tenant/dashboard')
        }
      } else {
        toast.error(result.error || 'Invalid credentials')
      }
    } catch (error) {
      toast.error('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetEmail) {
      toast.error('Please enter your email')
      return
    }
    setLoading(true)
    try {
      const result = await resetPassword(resetEmail)
      if (result.success) {
        toast.success('Password reset email sent! Check your inbox.')
        setShowReset(false)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error('Failed to send reset email')
    } finally {
      setLoading(false)
    }
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
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-16 h-16 bg-gradient-to-r from-slate-700 to-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md"
          >
            <span className="text-3xl">🏠</span>
          </motion.div>
          <h1 className="text-2xl font-bold text-slate-800">HOSTELSET</h1>
          <p className="text-gray-500 mt-1">Login to your account</p>
        </div>

        {/* Login Method Tabs - NEW */}
        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => { setLoginMethod('phone'); setStep('phone'); setShowReset(false); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              loginMethod === 'phone' ? 'bg-white text-slate-800 shadow-sm' : 'text-gray-500 hover:text-slate-600'
            }`}
          >
            📱 Phone OTP
          </button>
          <button
            onClick={() => { setLoginMethod('email'); setShowReset(false); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              loginMethod === 'email' ? 'bg-white text-slate-800 shadow-sm' : 'text-gray-500 hover:text-slate-600'
            }`}
          >
            ✉️ Email & Password
          </button>
        </div>

        <AnimatePresence mode="wait">
          {loginMethod === 'phone' ? (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {step === 'phone' ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">I am a</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setRole('owner')}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          role === 'owner'
                            ? 'border-slate-800 bg-slate-50 text-slate-800'
                            : 'border-gray-200 text-gray-500 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-2xl mb-1">🏢</div>
                        <div className="font-semibold">Property Owner</div>
                      </button>
                      <button
                        onClick={() => setRole('tenant')}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          role === 'tenant'
                            ? 'border-slate-800 bg-slate-50 text-slate-800'
                            : 'border-gray-200 text-gray-500 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-2xl mb-1">👤</div>
                        <div className="font-semibold">Tenant</div>
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-center">
                      {role === 'tenant' ? 'Only tenants added by owner can login' : 'Manage your property'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">Phone Number</label>
                    <div className="flex gap-2">
                      <span className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-200">+91</span>
                      <input
                        type="tel"
                        placeholder="9876543210"
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        maxLength={10}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Enter the number you registered with</p>
                  </div>

                  <button
                    onClick={sendOTP}
                    disabled={loading}
                    className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Continue →'}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">Enter OTP</label>
                    <input
                      type="text"
                      placeholder="123456"
                      className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength={6}
                    />
                    <p className="text-sm text-gray-500 mt-2">OTP sent to +91 {phone}</p>
                  </div>

                  <button
                    onClick={verifyOTP}
                    disabled={loading}
                    className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Verify & Login →'}
                  </button>

                  <button
                    onClick={() => setStep('phone')}
                    className="w-full text-slate-600 hover:text-slate-800 text-sm"
                  >
                    ← Change number
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {!showReset ? (
                <form onSubmit={handleEmailLogin} className="space-y-6">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">Email Address</label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Logging in...' : 'Login →'}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowReset(true)}
                      className="text-sm text-slate-600 hover:text-slate-800"
                    >
                      Forgot password?
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">Email Address</label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleResetPassword}
                    disabled={loading}
                    className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Send Reset Email'}
                  </button>
                  <button
                    onClick={() => setShowReset(false)}
                    className="w-full text-slate-600 hover:text-slate-800 text-sm"
                  >
                    ← Back to login
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 text-center">
          <Link href="/owner/register-property" className="text-slate-600 hover:text-slate-800 text-sm">
            📝 List Your Property →
          </Link>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Demo Phone OTP: 123456 | Demo Email: owner@example.com / password
          </p>
        </div>
      </motion.div>
    </div>
  )
}
