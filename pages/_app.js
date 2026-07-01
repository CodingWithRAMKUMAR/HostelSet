import '../styles/globals.css'
import 'leaflet/dist/leaflet.css'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { ErrorBoundary } from '../components/ErrorBoundary'

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    let active = true
    let subscription
    import('../lib/supabase').then(async ({ supabase, syncServerSession }) => {
      if (!active) return
      const { data: { session } } = await supabase.auth.getSession()
      if (session) syncServerSession(session).catch(() => {})
      const result = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') syncServerSession(nextSession).catch(() => {})
        if (event === 'SIGNED_OUT') syncServerSession(null).catch(() => {})
      })
      subscription = result.data.subscription
    }).catch(() => {})
    return () => { active = false; subscription?.unsubscribe() }
  }, [])

  useEffect(() => {
    let active = true
    const checkSession = async () => {
      try {
        const protectedRoutes = ['/owner', '/tenant', '/admin']
        const isProtectedRoute = protectedRoutes.some(route => router.pathname.startsWith(route))
        if (!isProtectedRoute) { if (active) setAuthorized(true); return }
        // getSession reads the persisted session locally and avoids an extra
        // network round-trip on every dashboard navigation.
        const { supabase } = await import('../lib/supabase')
        const { data: { session } } = await supabase.auth.getSession()
        if (!active) return
        if (session) setAuthorized(true)
        else if (router.pathname !== '/login') router.replace('/login')
      } catch (e) {
        // If accessing localStorage fails, treat as not authorized for protected routes
        const protectedRoutes = ['/owner', '/tenant', '/admin']
        const isProtectedRoute = protectedRoutes.some(route => router.pathname.startsWith(route))
        if (isProtectedRoute && router.pathname !== '/login') router.replace('/login')
        else setAuthorized(true)
      }
    }

    setAuthorized(false)
    checkSession()
    return () => { active = false }
  }, [router.pathname])

  return (
    <>
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: { background: '#1e293b', color: '#fff', borderRadius: '12px' },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      {(!router.pathname.startsWith('/owner') && !router.pathname.startsWith('/tenant') && !router.pathname.startsWith('/admin')) || authorized ? (
        <ErrorBoundary key={router.asPath}>
          <Component {...pageProps} />
        </ErrorBoundary>
      ) : null}
    </>
  )
}
