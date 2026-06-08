import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      
      toast.success('Password updated successfully! Please login with your new password.')
      router.push('/login')
    } catch (error) {
      console.error('Reset password error:', error)
      toast.error(error.message || 'Failed to update password')
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
          <div className="w-16 h-16 bg-gradient-to-r from-slate-700 to-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Reset Password</h1>
          <p className="text-gray-500 mt-1">Enter your new password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-700 font-semibold mb-2">New Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">Confirm Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
