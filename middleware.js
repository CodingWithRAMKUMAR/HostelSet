import { NextResponse } from 'next/server'

const COOKIE_NAME = 'hostelset_access_token'
const REFRESH_COOKIE_NAME = 'hostelset_refresh_token'
const PUBLIC_OWNER_ROUTES = new Set(['/owner/register-property'])

function loginRedirect(request, clearCookie = false) {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  const response = NextResponse.redirect(url)
  if (clearCookie) {
    response.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 })
    response.cookies.set(REFRESH_COOKIE_NAME, '', { path: '/', maxAge: 0 })
  }
  return response
}

function setSessionCookies(response, accessToken, refreshToken, expiresIn) {
  const secure = process.env.NODE_ENV === 'production'
  response.cookies.set(COOKIE_NAME, accessToken, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: Math.min(3600, Number(expiresIn || 3600)) })
  response.cookies.set(REFRESH_COOKIE_NAME, refreshToken, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 60 * 60 * 24 * 30 })
  return response
}

function dashboardFor(role) {
  if (role === 'admin') return '/admin/dashboard'
  if (role === 'owner') return '/owner/dashboard'
  return '/tenant/dashboard'
}

function requiredRole(pathname) {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/owner')) return 'owner'
  if (pathname.startsWith('/tenant')) return 'tenant'
  return null
}

export async function middleware(request) {
  const { pathname } = request.nextUrl
  if (PUBLIC_OWNER_ROUTES.has(pathname)) return NextResponse.next()

  const roleRequired = requiredRole(pathname)
  if (!roleRequired) return NextResponse.next()

  let token = request.cookies.get(COOKIE_NAME)?.value
  let refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value
  if (!token && !refreshToken) return loginRedirect(request)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return loginRedirect(request, true)

  try {
    token = token ? decodeURIComponent(token) : ''
    refreshToken = refreshToken ? decodeURIComponent(refreshToken) : ''
    let refreshedSession = null
    let authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!authResponse.ok && refreshToken) {
      const refreshResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: 'no-store',
      })
      if (refreshResponse.ok) {
        refreshedSession = await refreshResponse.json()
        token = refreshedSession.access_token
        refreshToken = refreshedSession.refresh_token
        authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
      }
    }
    if (!authResponse.ok) return loginRedirect(request, true)
    const user = await authResponse.json()
    if (!user?.id) return loginRedirect(request, true)

    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&select=role,is_active&limit=1`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
        cache: 'no-store',
      },
    )
    if (!profileResponse.ok) return loginRedirect(request, true)
    const [profile] = await profileResponse.json()
    if (!profile?.is_active || !['admin', 'owner', 'tenant'].includes(profile?.role)) {
      return loginRedirect(request, true)
    }

    if (profile.role !== roleRequired) {
      const url = request.nextUrl.clone()
      url.pathname = dashboardFor(profile.role)
      url.search = ''
      const response = NextResponse.redirect(url)
      return refreshedSession ? setSessionCookies(response, token, refreshToken, refreshedSession.expires_in) : response
    }
    const response = NextResponse.next()
    return refreshedSession ? setSessionCookies(response, token, refreshToken, refreshedSession.expires_in) : response
  } catch {
    return loginRedirect(request, true)
  }
}

export const config = {
  matcher: ['/admin/:path*', '/owner/:path*', '/tenant/:path*'],
}
