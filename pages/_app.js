import '../styles/globals.css'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function App({ Component, pageProps }) {
  const router = useRouter()

  useEffect(() => {
    const checkSession = () => {
      const isLoggedIn = localStorage.getItem('isLoggedIn')
      const protectedRoutes = ['/owner', '/tenant']
      const isProtectedRoute = protectedRoutes.some(route => router.pathname.startsWith(route))
      
      if (isProtectedRoute && !isLoggedIn && router.pathname !== '/login') {
        router.push('/login')
      }
    }
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
      <Component {...pageProps} />
    </>
  )
}
