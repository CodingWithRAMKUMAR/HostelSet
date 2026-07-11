import '../styles/globals.css'
import 'leaflet/dist/leaflet.css'
import { Toaster, toast } from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { ErrorBoundary } from '../components/ErrorBoundary'
import Head from 'next/head'
import MonitoringScripts from '../components/MonitoringScripts'
import { NotificationProvider } from '../context/NotificationContext'
import { ThemeProvider } from '../context/ThemeContext'

function ProtectedRouteLoading() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center" aria-busy="true" aria-label="Checking session">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-sm font-medium text-gray-500">Checking your session...</p>
      </div>
    </main>
  )
}

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const isDashboardRoute = router.pathname.startsWith('/owner') || router.pathname.startsWith('/tenant') || router.pathname.startsWith('/admin')

  useEffect(() => {
    let active = true
    let subscription
    import('../lib/supabase').then(async ({ supabase, syncServerSession, getRestoredSession }) => {
      if (!active) return
      const { data: { session } } = await getRestoredSession({ retryDelay: 150 })
      if (session) syncServerSession(session).catch(() => {})
      const result = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (nextSession) syncServerSession(nextSession).catch(() => {})
        }
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
        const { syncServerSession, getRestoredSession } = await import('../lib/supabase')
        const { data: { session } } = await getRestoredSession()
        if (!active) return
        if (session) {
          syncServerSession(session).catch(() => {})
          setAuthorized(true)
        }
        else if (router.pathname !== '/login') router.replace(`/login?next=${encodeURIComponent(router.asPath)}`)
      } catch (e) {
        // If accessing localStorage fails, treat as not authorized for protected routes
        const protectedRoutes = ['/owner', '/tenant', '/admin']
        const isProtectedRoute = protectedRoutes.some(route => router.pathname.startsWith(route))
        if (isProtectedRoute && router.pathname !== '/login') router.replace(`/login?next=${encodeURIComponent(router.asPath)}`)
        else setAuthorized(true)
      }
    }

    setAuthorized(false)
    checkSession()
    return () => { active = false }
  }, [router.pathname, router.asPath])

  useEffect(() => {
    const handlePageShow = async (event) => {
      if (!event.persisted) return
      const protectedRoutes = ['/owner', '/tenant', '/admin']
      const isProtectedRoute = protectedRoutes.some(route => router.pathname.startsWith(route))
      if (!isProtectedRoute) return
      const { getRestoredSession } = await import('../lib/supabase')
      const { data: { session } } = await getRestoredSession()
      if (!session) router.replace(`/login?next=${encodeURIComponent(router.asPath)}`)
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [router])

  useEffect(() => {
    const handleOffline = () => toast.error('You are offline. Your information is preserved; reconnect before trying again.', { id: 'network-status' })
    const handleOnline = () => toast.success('Connection restored.', { id: 'network-status' })
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    if (!navigator.onLine) handleOffline()
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  return (
    <>
      <Head>
        <meta name="application-name" content="HostelSet" />
        <meta name="theme-color" content="#4f46e5" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="HostelSet" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/icons/icon-192x192.png" sizes="192x192" />
        <link rel="icon" type="image/png" href="/icons/icon-512x512.png" sizes="512x512" />
      </Head>
      <MonitoringScripts />
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: { background: '#1e293b', color: '#fff', borderRadius: '12px' },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <ThemeProvider>
        {!isDashboardRoute || authorized ? (
          isDashboardRoute ? (
            <NotificationProvider>
              <ErrorBoundary key={router.asPath}>
                <Component {...pageProps} />
              </ErrorBoundary>
            </NotificationProvider>
          ) : (
            <ErrorBoundary key={router.asPath}>
              <Component {...pageProps} />
            </ErrorBoundary>
          )
        ) : <ProtectedRouteLoading />}
      </ThemeProvider>
    </>
  )
}
