import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [accessToken, setAccessToken] = useState(null)

  useEffect(() => {
    // Get the full URL hash (e.g., #access_token=xyz&type=recovery)
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1))
      const token = params.get('access_token')
      if (token) {
        setAccessToken(token)
      } else {
        toast.error('Invalid reset link. Please request a new one.')
        router.push('/login')
      }
    } else {
      toast.error('No reset token found. Please request a new password reset.')
      router.push('/login')
    }
  }, [router])

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
      // Update the user's password using the access token
      const { error } = await supabase.auth.updateUser(
        { password },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (error) throw error
      toast.success('Password updated successfully! Please login with your new password.')
      router.push('/login')
    } catch (error) {
      console.error('Reset error:', error)
      toast.error(error.message || 'Failed to update password. Please request a new reset link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-white">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6">Reset Your Password</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="New password"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Confirm new password"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading || !accessToken}
            className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
