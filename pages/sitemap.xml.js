import { supabase } from '../lib/supabase'
import { propertyPublicPath } from '../lib/propertySlug'

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.hostelset.com').replace(/\/$/, '')
const PUBLIC_PATHS = [
  '/',
  '/properties',
  '/about',
  '/contact',
  '/support',
  '/faq',
  '/privacy-policy',
  '/terms',
  '/refund-policy',
]

const escapeXml = value => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

const urlEntry = ({ path, lastmod }) => `  <url>
    <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>${lastmod ? `
    <lastmod>${escapeXml(new Date(lastmod).toISOString())}</lastmod>` : ''}
  </url>`

export async function getServerSideProps({ res }) {
  const { data: properties, error } = await supabase.rpc('get_public_properties')

  if (error) throw error

  const urls = [
    ...PUBLIC_PATHS.map(path => ({ path })),
    ...(properties || []).map(property => ({
      path: propertyPublicPath(property),
      lastmod: property.updated_at || property.created_at,
    })),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(urlEntry).join('\n')}
</urlset>`

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.write(xml)
  res.end()

  return { props: {} }
}

export default function Sitemap() {
  return null
}
