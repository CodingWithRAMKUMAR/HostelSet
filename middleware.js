import { NextResponse } from 'next/server'
import { getUserFromSession } from './lib/auth'

export async function middleware(request) {
  const sessionToken = request.cookies.get('session')?.value
  const { pathname } = request.nextUrl
  
  // Public routes (no authentication needed)
  const publicRoutes = ['/', '/login', '/api/auth/send-magic-link', '/api/auth/verify-magic-link', '/api/auth/complete-registration', '/property']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  // Get user from session
  const user = sessionToken ? await getUserFromSession(sessionToken) : null
  
  // If trying to access protected route without user
  if (!isPublicRoute && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  // Role-based redirects (prevent owners from accessing tenant routes and vice versa)
  if (user) {
    // If owner trying to access tenant routes
    if (user.role === 'owner' && pathname.startsWith('/tenant')) {
      return NextResponse.redirect(new URL('/owner/dashboard', request.url))
    }
    
    // If tenant trying to access owner routes
    if (user.role === 'tenant' && pathname.startsWith('/owner')) {
      return NextResponse.redirect(new URL('/tenant/dashboard', request.url))
    }
    
    // If logged in user tries to access login page
    if (pathname === '/login') {
      if (user.role === 'owner') {
        return NextResponse.redirect(new URL('/owner/dashboard', request.url))
      } else if (user.role === 'tenant') {
        return NextResponse.redirect(new URL('/tenant/dashboard', request.url))
      }
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
