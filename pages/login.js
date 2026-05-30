import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

export default function Login() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('phone')
  const [loading, setLoading] = useState(false)

  const sendOTP = () => {
    if (phone.length !== 10) {
      alert('Please enter a valid 10-digit phone number')
      return
    }
    setLoading(true)
    setTimeout(() => {
      alert('Demo OTP: 123456')
      setStep('otp')
      setLoading(false)
    }, 1000)
  }

  const verifyOTP = () => {
    if (otp.length !== 6) {
      alert('Please enter 6-digit OTP')
      return
    }
    setLoading(true)
    setTimeout(() => {
      if (otp === '123456') {
        localStorage.setItem('isLoggedIn', 'true')
        localStorage.setItem('userRole', 'owner')
        alert('Login successful!')
        router.push('/owner/dashboard')
      } else {
        alert('Invalid OTP. Use 123456')
      }
      setLoading(false)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">🏠 HOSTELSET</h1>
          <h2 className="text-2xl font-bold mt-4">Welcome Back</h2>
          <p className="text-gray-500 mt-2">Login to manage your property</p>
        </div>

        {step === 'phone' ? (
          <>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Phone Number</label>
              <div className="flex gap-2">
                <span className="bg-gray-100 px-4 py-3 rounded-lg border">+91</span>
                <input
                  type="tel"
                  placeholder="9876543210"
                  className="input flex-1"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={10}
                />
              </div>
            </div>
            <button
              onClick={sendOTP}
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Enter OTP</label>
              <input
                type="text"
                placeholder="123456"
                className="input text-center text-2xl tracking-widest"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
              />
              <p className="text-sm text-gray-500 mt-2">OTP sent to +91 {phone}</p>
            </div>
            <button
              onClick={verifyOTP}
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button
              onClick={() => setStep('phone')}
              className="w-full mt-3 text-primary hover:underline"
            >
              ← Change phone number
            </button>
          </>
        )}

        <div className="mt-6 text-center">
          <Link href="/register" className="text-primary hover:underline">
            New Owner? Register your property →
          </Link>
        </div>

        <div className="mt-4 text-center text-xs text-gray-400">
          Demo: Any phone number, OTP: 123456
        </div>
      </div>
    </div>
  )
}
