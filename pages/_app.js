import '../styles/globals.css'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // ✅ SECURITY FIX: Validate session with Supabase on app load
    const checkSession = async () => {
      try {
        // First, check if we have a Supabase session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          // Session exists - user is logged in
          localStorage.setItem('userId', session.user.id)
          localStorage.setItem('isLoggedIn', 'true')
          setAuthorized(true)
        } else {
          // No Supabase session - clear localStorage
          localStorage.removeItem('userId')
          localStorage.removeItem('isLoggedIn')
          setAuthorized(false)

          // Redirect to login if on protected route
          const protectedRoutes = ['/owner', '/tenant', '/admin']
          if (protectedRoutes.some(route => router.pathname.startsWith(route))) {
            router.replace('/login')
          }
        }
      } catch (error) {
        console.error('Session check error:', error)
        setAuthorized(false)
      } finally {
        setLoading(false)
      }
    }

    checkSession()

    // ✅ Listen for auth state changes (logout in other tabs, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          localStorage.setItem('userId', session.user.id)
          localStorage.setItem('isLoggedIn', 'true')
          setAuthorized(true)
        } else {
          localStorage.removeItem('userId')
          localStorage.removeItem('isLoggedIn')
          setAuthorized(false)
        }
      }
    )

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

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
      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (!router.pathname.startsWith('/owner') && !router.pathname.startsWith('/tenant') && !router.pathname.startsWith('/admin')) || authorized ? (
        <Component {...pageProps} />
      ) : null}
    </>
  )
}
