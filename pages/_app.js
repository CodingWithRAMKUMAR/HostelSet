import '../styles/globals.css'
import { Toaster } from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const checkSession = () => {
      try {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
        const protectedRoutes = ['/owner', '/tenant', '/admin']
        const isProtectedRoute = protectedRoutes.some(route => router.pathname.startsWith(route))

        if (isProtectedRoute) {
          if (isLoggedIn) {
            setAuthorized(true)
          } else if (router.pathname !== '/login') {
            router.replace('/login')
          }
        } else {
          setAuthorized(true)
        }
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
        <Component {...pageProps} />
      ) : null}
    </>
  )
}
