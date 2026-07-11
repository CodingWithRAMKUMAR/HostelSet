import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { signInWithEmail, resetPassword, syncServerSession, signOut } from '../lib/supabase'
import { cleanPhoneNumber } from '../lib/utils'
import toast from 'react-hot-toast'
import BrandLogo from '../components/BrandLogo'
import { fetchWithTimeout } from '../lib/fetchWithTimeout'

const ROLE_COPY = {
  tenant: {
    title: 'Tenant Login',
    helper: 'Use the account shared after owner approval.',
    wrong: 'You are signed in as a different role. Use the correct login below.',
  },
  owner: {
    title: 'Owner Login',
    helper: 'Manage your HostelSet property dashboard.',
    wrong: 'This account is not an owner account. Use the correct login below.',
  },
  admin: {
    title: 'Admin Login',
    helper: 'Admin access is restricted to authorized staff.',
    wrong: 'This account does not have admin access.',
  },
}

const validRole = role => ['tenant', 'owner', 'admin'].includes(role) ? role : ''

export default function Login() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginStatus, setLoginStatus] = useState('')
  const [formError, setFormError] = useState('')
  const identifierRef = useRef(null)
  const passwordRef = useRef(null)
  const loginTimingRef = useRef(null)
  const requestedRole = validRole(router.query.role)
  const roleCopy = ROLE_COPY[requestedRole] || { title: 'Login', helper: 'Login with email or mobile number.' }

  const isEmail = input => input.includes('@')
  const isPhone = input => /^\d{10}$/.test(cleanPhoneNumber(input))

  const roleDestinationFor = role => {
    if (role === 'admin') return '/admin/dashboard'
    if (role === 'owner') return '/owner/dashboard'
    return '/tenant/dashboard'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    if (!identifier || !password) {
      const message = 'Please enter email/phone and password'
      setFormError(message)
      toast.error(message)
      if (!identifier) identifierRef.current?.focus()
      else passwordRef.current?.focus()
      return
    }
    setFormError('')
    setLoading(true)
    setLoginStatus('Signing in...')
    loginTimingRef.current = typeof performance !== 'undefined' ? { start: performance.now(), marks: [] } : null
    const markLoginTiming = (label) => {
      if (process.env.NODE_ENV === 'production' || !loginTimingRef.current || typeof performance === 'undefined') return
      loginTimingRef.current.marks.push({ label, ms: Math.round(performance.now() - loginTimingRef.current.start) })
    }
    markLoginTiming('submit-feedback')
    let redirectStarted = false

    try {
      let emailToUse = identifier.trim()

      if (isPhone(identifier)) {
        setLoginStatus('Finding your account...')
        const response = await fetchWithTimeout('/api/auth/resolve-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: identifier }),
        }, 10000)
        const payload = await response.json()
        if (!response.ok || !payload.email) {
          toast.error('No account found with this phone number.')
          setLoading(false)
          return
        }
        markLoginTiming('identifier-resolved')
        emailToUse = payload.email
      } else if (!isEmail(identifier)) {
        const message = 'Enter a valid email or 10-digit mobile number'
        setFormError(message)
        toast.error(message)
        identifierRef.current?.focus()
        setLoading(false)
        return
      }

      const result = await signInWithEmail(emailToUse, password)
      markLoginTiming('auth-completed')

      if (result.success) {
        if (requestedRole && result.role !== requestedRole) {
          const actualRole = validRole(result.role)
          const correctLink = actualRole ? `/login/${actualRole}` : '/login'
          await signOut()
          toast.error(requestedRole === 'admin'
            ? 'This account does not have admin access.'
            : `You are signed in as a ${actualRole || 'different role'}. Use ${actualRole === 'tenant' ? 'Tenant' : actualRole === 'owner' ? 'Owner' : 'the correct'} Login.`
          )
          router.replace(`${correctLink}?wrongRole=1`)
          return
        }

        const roleDestination = roleDestinationFor(result.role)
        const requestedNext = typeof router.query.next === 'string' ? router.query.next : ''
        const destination = requestedNext.startsWith(roleDestination) ? requestedNext : roleDestination
        if (!result.session) throw new Error('Unable to establish your session')
        setLoginStatus('Opening your dashboard...')
        await syncServerSession(result.session)
        markLoginTiming('session-cookie-synced')
        toast.success(`Welcome back, ${result.userData.full_name}!`)
        if (process.env.NODE_ENV !== 'production' && loginTimingRef.current) {
          console.info('[HostelSet] login timing', loginTimingRef.current.marks)
        }
        window.location.replace(destination)
        redirectStarted = true
        window.setTimeout(() => {
          setLoading(false)
          setLoginStatus('')
        }, 1000)
      } else if (result.error?.includes('Email not confirmed')) {
        toast.error('Please confirm your email first. Check your inbox.')
      } else if (result.error?.includes('Invalid login credentials')) {
        const message = 'Wrong email or password. Please try again.'
        setFormError(message)
        toast.error(message)
      } else if (result.error?.includes('deactivated')) {
        const message = 'Your account has been deactivated. Contact support.'
        setFormError(message)
        toast.error(message)
      } else {
        const message = result.error || 'Login failed. Please try again.'
        setFormError(message)
        toast.error(message)
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Login error:', error)
      const message = 'Login failed. Please try again.'
      setFormError(message)
      toast.error(message)
    } finally {
      if (!redirectStarted) {
        setLoading(false)
        setLoginStatus('')
      }
    }
  }

  const handleResetPassword = async () => {
    if (!resetEmail) {
      toast.error('Please enter your email')
      return
    }
    setLoading(true)
    const result = await resetPassword(resetEmail)
    if (result.success) {
      toast.success('Password reset email sent! Check your inbox and spam.')
      setShowReset(false)
    } else {
      toast.error(result.error || 'Failed to send reset email')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-white">
      <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-8 max-w-md w-full border border-gray-100 animate-fade-in">
        <div className="text-center mb-8">
          <BrandLogo size="login" priority className="mx-auto mb-2" />
          <h1 className="text-xl font-bold text-slate-900">{roleCopy.title}</h1>
          <p className="text-gray-500 mt-1">{roleCopy.helper}</p>
          {router.query.wrongRole && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{roleCopy.wrong}</p>}
        </div>

        {!showReset ? (
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <div>
              <label htmlFor="login-identifier" className="block text-gray-700 font-semibold mb-2">Email or Mobile Number</label>
              <input
                ref={identifierRef}
                id="login-identifier"
                name="identifier"
                type="text"
                placeholder="you@example.com or 9876543210"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800 transition"
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); if (formError) setFormError('') }}
                autoComplete="username"
                required
                aria-invalid={Boolean(formError && !identifier)}
                aria-describedby={formError ? 'login-error' : undefined}
              />
              <p className="text-xs text-gray-400 mt-1">Use the email or phone you registered with.</p>
            </div>
            <div>
              <label htmlFor="login-password" className="block text-gray-700 font-semibold mb-2">Password</label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800 pr-12 transition"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (formError) setFormError('') }}
                  autoComplete="current-password"
                  required
                  aria-invalid={Boolean(formError && identifier && !password)}
                  aria-describedby={formError ? 'login-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-slate-800 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {formError && <p id="login-error" role="alert" className="-mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{formError}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50"
            >
              {loading ? loginStatus || 'Logging in...' : 'Login →'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowReset(true)}
                className="text-sm text-slate-600 hover:text-slate-800 transition"
              >
                Forgot password?
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div>
              <label htmlFor="reset-email" className="block text-gray-700 font-semibold mb-2">Your Email Address</label>
              <input
                id="reset-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                autoComplete="email"
              />
              <p className="text-xs text-gray-400 mt-1">We'll send a password reset link to this email.</p>
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
              className="w-full text-slate-600 hover:text-slate-800 text-sm transition"
            >
              ← Back to login
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/register" className="text-slate-600 hover:text-slate-800 text-sm transition">
            Register Your Property →
          </Link>
        </div>
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">New tenants do not create accounts directly. Apply to a hostel first.</p>
        </div>
        <div className="mt-4 flex justify-center gap-3 text-xs">
          <Link href="/login/tenant" className="text-slate-500 hover:text-slate-900">Tenant</Link>
          <Link href="/login/owner" className="text-slate-500 hover:text-slate-900">Owner</Link>
          <Link href="/login/admin" className="text-slate-500 hover:text-slate-900">Admin</Link>
        </div>
      </div>
    </div>
  )
}
