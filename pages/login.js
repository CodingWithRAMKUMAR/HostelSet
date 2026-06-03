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
    if (phone.length !== 10) { toast.error('Enter 10-digit phone number'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: `+91${phone}` })
      if (error) throw error
      toast.success('OTP sent!')
      setStep('otp')
    } catch (error) { toast.success('Demo mode: Use OTP 123456'); setStep('otp') }
    setLoading(false)
  }

  const verifyOTP = async () => {
    if (otp.length !== 6) { toast.error('Enter 6-digit OTP'); return }
    setLoading(true)
    try {
      if (otp === '123456') {
        // First, check if user exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('phone', `+91${phone}`)
          .maybeSingle()
        
        console.log('Existing user:', existingUser)
        
        if (existingUser) {
          // For tenant role, check if they have a room assigned
          if (existingUser.role === 'tenant') {
            // IMPORTANT: Use phone number to find tenant, NOT user_id
            const { data: tenant } = await supabase
              .from('tenants')
              .select('id, room_id, status')
              .eq('phone', phone)  // Changed from user_id to phone
              .maybeSingle()
            
            console.log('Tenant record:', tenant)
            
            if (!tenant || !tenant.room_id) {
              toast.error('You are not registered with any room. Please contact your PG owner.')
              setLoading(false)
              return
            }
            if (tenant.status === 'checked_out') {
              toast.error('Your account has been checked out. Please contact owner.')
              setLoading(false)
              return
            }
          }
          
          localStorage.setItem('userId', existingUser.id)
          localStorage.setItem('userRole', existingUser.role)
          localStorage.setItem('isLoggedIn', 'true')
          localStorage.setItem('userName', existingUser.full_name)
          localStorage.setItem('userPhone', phone)  // Store phone for debugging
          
          toast.success(`Welcome back, ${existingUser.full_name}!`)
          
          if (existingUser.role === 'owner') {
            const { data: property } = await supabase
              .from('properties')
              .select('id')
              .eq('owner_id', existingUser.id)
              .maybeSingle()
            property ? router.push('/owner/dashboard') : router.push('/owner/register-property')
          } else {
            router.push('/tenant/dashboard')
          }
        } else {
          // Create new user
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({ 
              phone: `+91${phone}`, 
              full_name: `User_${phone.slice(-4)}`, 
              role 
            })
            .select()
            .single()
          
          if (createError) throw createError
          
          localStorage.setItem('userId', newUser.id)
          localStorage.setItem('userRole', newUser.role)
          localStorage.setItem('isLoggedIn', 'true')
          localStorage.setItem('userName', newUser.full_name)
          localStorage.setItem('userPhone', phone)
          
          toast.success('Account created!')
          
          if (role === 'owner') {
            router.push('/owner/register-property')
          } else {
            router.push('/tenant/waiting')
          }
        }
      } else {
        await supabase.auth.verifyOtp({ phone: `+91${phone}`, token: otp, type: 'sms' })
      }
    } catch (error) { 
      console.error('Login error:', error)
      toast.error('Invalid OTP. Use 123456') 
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0f172a' }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-secondary rounded-2xl p-8 max-w-md w-full border border-gray-800">
        <div className="text-center mb-8"><div className="text-4xl mb-2">🏠</div><h1 className="text-2xl font-bold text-primary">HOSTELSET</h1><p className="text-gray-400 mt-2">Login to your account</p></div>
        <AnimatePresence mode="wait">
          {step === 'phone' ? (
            <motion.div key="phone" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              <div><label className="block text-gray-300 mb-2">I am a</label><div className="grid grid-cols-2 gap-3">
                <button onClick={() => setRole('owner')} className={`p-3 rounded-xl border-2 ${role === 'owner' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-700 text-gray-400'}`}>🏢 Owner</button>
                <button onClick={() => setRole('tenant')} className={`p-3 rounded-xl border-2 ${role === 'tenant' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-700 text-gray-400'}`}>👤 Tenant</button>
              </div><p className="text-xs text-gray-500 mt-2 text-center">{role === 'tenant' ? 'Only tenants added by owner can login' : 'Manage your property'}</p></div>
              <div><label className="block text-gray-300 mb-2">Phone Number</label><div className="flex gap-2"><span className="bg-dark px-4 py-3 rounded-xl border border-gray-700">+91</span><input type="tel" placeholder="9876543210" className="input flex-1" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={10} /></div></div>
              <button onClick={sendOTP} disabled={loading} className="btn-primary w-full">{loading ? 'Sending...' : 'Continue →'}</button>
            </motion.div>
          ) : (
            <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div><label className="block text-gray-300 mb-2">Enter OTP</label><input type="text" placeholder="123456" className="input text-center text-2xl tracking-widest" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} /><p className="text-sm text-gray-500 mt-2">OTP sent to +91 {phone}</p></div>
              <button onClick={verifyOTP} disabled={loading} className="btn-primary w-full">{loading ? 'Verifying...' : 'Verify & Login →'}</button>
              <button onClick={() => setStep('phone')} className="w-full text-primary text-sm">← Change number</button>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-6 text-center"><Link href="/owner/register-property" className="text-primary text-sm">List Your Property →</Link></div>
        <div className="mt-4 text-center text-xs text-gray-500">Demo: Any phone | OTP: 123456</div>
      </motion.div>
    </div>
  )
}
