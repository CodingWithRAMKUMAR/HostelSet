const isProduction = process.env.NODE_ENV === 'production'

const supabaseHttpOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  } catch {
    return null
  }
})()

const supabaseWebSocketOrigin = supabaseHttpOrigin
  ? supabaseHttpOrigin.replace(/^http/, 'ws')
  : null

const compact = (values) => values.filter(Boolean)

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src ${compact(["'self'", "'unsafe-inline'", !isProduction && "'unsafe-eval'"]).join(' ')}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src ${compact(["'self'", 'data:', 'blob:', 'https://*.supabase.co', supabaseHttpOrigin, 'https://maps.geoapify.com']).join(' ')}`,
  `connect-src ${compact(["'self'", 'https://*.supabase.co', 'wss://*.supabase.co', supabaseHttpOrigin, supabaseWebSocketOrigin, 'https://api.geoapify.com', 'https://maps.geoapify.com']).join(' ')}`,
  `media-src ${compact(["'self'", 'blob:', 'https://*.supabase.co', supabaseHttpOrigin]).join(' ')}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  isProduction && 'upgrade-insecure-requests',
].filter(Boolean).join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(), payment=(), picture-in-picture=(), publickey-credentials-get=(self), usb=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
