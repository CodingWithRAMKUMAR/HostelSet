import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function AuthCallback() {
  const router = useRouter()
  const { userId, role, email } = router.query
  
  useEffect(() => {
    // Only proceed if we have userId and role
    if (userId && role) {
      // Store user information in localStorage
      localStorage.setItem('userId', userId)
      localStorage.setItem('userRole', role)
      localStorage.setItem('isLoggedIn', 'true')
      localStorage.setItem('userEmail', email || '')
      
      // Redirect to appropriate dashboard based on role
      if (role === 'owner') {
        router.push('/owner/dashboard')
      } else {
        router.push('/tenant/dashboard')
      }
    }
  }, [userId, role, email, router])
  
  // Show loading spinner while processing
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Logging you in...</p>
      </div>
    </div>
  )
}
