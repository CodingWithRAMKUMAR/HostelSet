import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { resetPassword, supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [error, setError] = useState(null)
  const [linkType, setLinkType] = useState('reset')

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

    if (callbackType === 'invite') setLinkType('invite')
    else if (callbackType === 'recovery') setLinkType('reset')

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
        setError(callbackError.replace(/\+/g, ' ') || 'This password link is invalid or expired.')
        return
      }
      if (!expectsAuthCallback) {
        setError('This password link is invalid or expired. Request a new link below.')
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
      else if (callbackFailure) setError(callbackFailure.message || 'This password link is invalid or expired. Request a new link below.')
      else {
        timeout = setTimeout(() => {
          if (!resolved) setError('This password link is invalid or expired. Request a new link below.')
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
      toast.success('Password set successfully. Please log in.')
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

  const handleResend = async event => {
    event.preventDefault()
    const email = resendEmail.trim()
    if (!email) return toast.error('Please enter your email')
    setResendLoading(true)
    const result = await resetPassword(email)
    if (result.success) {
      toast.success('Password setup email sent. Please check your inbox and spam folder.')
      setResendEmail('')
    } else {
      toast.error(result.error || 'Failed to send password email')
    }
    setResendLoading(false)
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-white">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4 font-bold text-red-500">!</div>
          <p className="text-red-600 mb-5 font-semibold">{error}</p>
          <form onSubmit={handleResend} className="space-y-3 text-left">
            <label className="block text-sm font-semibold text-gray-700">Email address</label>
            <input type="email" placeholder="you@example.com" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={resendEmail} onChange={event => setResendEmail(event.target.value)} />
            <button type="submit" disabled={resendLoading} className="w-full bg-slate-800 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50">{resendLoading ? 'Sending...' : 'Send New Link'}</button>
          </form>
          <button onClick={() => router.push('/login')} className="mt-4 text-sm text-slate-600 hover:text-slate-800">Back to Login</button>
        </div>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-white">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800 mx-auto" />
          <p className="mt-4 text-gray-600">Verifying password link...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-white">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2">HostelSet</div>
          <h1 className="text-2xl font-bold text-slate-800">{linkType === 'invite' ? 'Create Password' : 'Set New Password'}</h1>
          <p className="text-gray-500 text-sm mt-1">Choose a password for your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="password" placeholder="New password (min 6 characters)" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={password} onChange={event => setPassword(event.target.value)} required />
          <input type="password" placeholder="Confirm new password" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required />
          <button type="submit" disabled={loading} className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50">{loading ? 'Updating...' : 'Set Password'}</button>
        </form>
      </div>
    </div>
  )
}
