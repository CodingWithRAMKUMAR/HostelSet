import { useEffect, useState } from 'react'
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
    if (!router.isReady) return
    let resolved = false
    let timeout
    const query = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const callbackError = query.get('error_description') || hash.get('error_description')
    const code = query.get('code')
    const tokenHash = query.get('token_hash')
    const callbackType = query.get('type') || hash.get('type')
    const hasHashSession = Boolean(hash.get('access_token') && hash.get('refresh_token'))
    const expectsAuthCallback = Boolean(code || tokenHash || hasHashSession || ['invite', 'recovery'].includes(callbackType))

    const acceptSession = () => {
      resolved = true
      setError(null)
      setSessionReady(true)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') acceptSession()
      else if (event === 'SIGNED_IN' && session && expectsAuthCallback) acceptSession()
    })

    const resolveCallback = async () => {
      if (callbackError) {
        setError(callbackError.replace(/\+/g, ' '))
        return
      }
      if (!expectsAuthCallback) {
        setError('Invalid or expired reset link. Please request a new one.')
        return
      }

      let callbackFailure = null
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        callbackFailure = exchangeError
      } else if (tokenHash && ['invite', 'recovery'].includes(callbackType)) {
        const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: callbackType })
        callbackFailure = verifyError
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (session) acceptSession()
      else if (callbackFailure) setError(callbackFailure.message || 'Invalid or expired reset link. Please request a new one.')
      else {
        timeout = setTimeout(() => {
          if (!resolved) setError('Invalid or expired reset link. Please request a new one.')
        }, 5000)
      }
    }
    resolveCallback()

    return () => {
      if (timeout) clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [router.isReady])

  const handleSubmit = async event => {
    event.preventDefault()
    if (password !== confirmPassword) return toast.error('Passwords do not match')
    if (password.length < 6) return toast.error('Password must be at least 6 characters')

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      toast.success('Password set successfully! Please login.')
      await supabase.auth.signOut()
      await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {})
      router.push('/login')
    } catch (updateError) {
      console.error(updateError)
      toast.error(updateError.message || 'Failed to update password')
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
          <button onClick={() => router.push('/login')} className="bg-slate-800 text-white px-6 py-2 rounded-xl">Back to Login</button>
        </div>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800 mx-auto" />
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
          <input type="password" placeholder="New password (min 6 characters)" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={password} onChange={event => setPassword(event.target.value)} required />
          <input type="password" placeholder="Confirm new password" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required />
          <button type="submit" disabled={loading} className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50">{loading ? 'Updating...' : 'Set Password →'}</button>
        </form>
      </div>
    </div>
  )
}
