import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Supabase automatically handles the token from the URL hash
    // We just need to listen for the session to be set
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          // ✅ Session is now set, user can update password
          setSessionReady(true)
        } else if (event === 'SIGNED_IN' && session) {
          // ✅ Also handles cases where session comes in as SIGNED_IN
          setSessionReady(true)
        }
      }
    )

    // Fallback: check if session already exists (page reload case)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true)
      } else {
        // Give it 3 seconds to detect token from URL
        setTimeout(() => {
          if (!sessionReady) {
            setError('Invalid or expired reset link. Please request a new one.')
          }
        }, 3000)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

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
      // ✅ CORRECT way - session is already set by onAuthStateChange
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      toast.success('Password set successfully! Please login.')

      // Sign out so they login fresh
      await supabase.auth.signOut()
      router.push('/login')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-red-600 mb-4 font-semibold">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="bg-slate-800 text-white px-6 py-2 rounded-xl"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying reset link...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-white">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold text-slate-800">Set New Password</h1>
          <p className="text-gray-500 text-sm mt-1">Choose a strong password</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="New password (min 6 characters)"
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
            disabled={loading}
            className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Set Password →'}
          </button>
        </form>
      </div>
    </div>
  )
}
