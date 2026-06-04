import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('owner')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  
  // Check for error in URL
  useEffect(() => {
    const error = router.query.error
    if (error) {
      toast.error(decodeURIComponent(error))
    }
  }, [router.query.error])
  
  const sendMagicLink = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }
    
    setLoading(true)
    
    try {
      const response = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setSent(true)
        setCountdown(60)
        
        // Start countdown timer for resend
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer)
              return 0
            }
            return prev - 1
          })
        }, 1000)
        
        toast.success('Magic link sent! Check your email.')
      } else {
        toast.error(data.error || 'Failed to send magic link')
      }
    } catch (error) {
      console.error('Send magic link error:', error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  
  const handleResend = () => {
    if (countdown > 0) return
    sendMagicLink()
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
        
        <AnimatePresence mode="wait">
          {!sent ? (
            <motion.div
              key="form"
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
                <label className="block text-gray-700 font-semibold mb-2">Email Address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800 transition"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">We'll send you a magic login link</p>
              </div>
              
              <button
                onClick={sendMagicLink}
                disabled={loading}
                className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  '✉️ Send Magic Link'
                )}
              </button>
              
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-700">
                  🔐 No password needed! We'll email you a one-click login link.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="sent"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center space-y-6"
            >
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <span className="text-4xl">📧</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Check Your Email</h2>
                <p className="text-gray-500 mt-2">
                  We sent a magic link to <strong>{email}</strong>
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Click the link in the email to log in instantly.
                </p>
              </div>
              
              <div className="bg-blue-50 rounded-xl p-4 text-left">
                <p className="text-sm text-blue-700 font-semibold mb-2">💡 No password needed!</p>
                <p className="text-xs text-blue-600">
                  Just click the button in the email and you'll be logged in automatically.
                  No OTP to type. No password to remember.
                </p>
              </div>
              
              <button
                onClick={handleResend}
                disabled={countdown > 0}
                className="text-slate-600 hover:text-slate-800 text-sm disabled:opacity-50"
              >
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend magic link →'}
              </button>
              
              <button
                onClick={() => setSent(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ← Use different email
              </button>
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
            🔐 Secure magic link authentication • No passwords needed
          </p>
        </div>
      </motion.div>
    </div>
  )
}
