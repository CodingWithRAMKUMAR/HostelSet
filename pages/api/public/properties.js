import { createClient } from '@supabase/supabase-js'

const CACHE_TTL_MS = 15 * 1000
const STALE_MAX_AGE_MS = 5 * 60 * 1000

let cachedProperties = null
let cachedAt = 0
let inFlightRequest = null

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

async function fetchFreshProperties() {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase.rpc('get_public_properties_v2')

  if (error) {
    throw new Error(error.message || 'Failed to load public properties')
  }

  const properties = Array.isArray(data) ? data : []

  cachedProperties = properties
  cachedAt = Date.now()

  return properties
}

async function getProperties() {
  const now = Date.now()
  const cacheAge = now - cachedAt

  if (cachedProperties && cacheAge < CACHE_TTL_MS) {
    return {
      data: cachedProperties,
      cacheStatus: 'HIT',
      stale: false,
    }
  }

  if (!inFlightRequest) {
    inFlightRequest = fetchFreshProperties().finally(() => {
      inFlightRequest = null
    })
  }

  try {
    const data = await inFlightRequest

    return {
      data,
      cacheStatus: 'MISS',
      stale: false,
    }
  } catch (error) {
    const staleAge = Date.now() - cachedAt

    if (cachedProperties && staleAge < STALE_MAX_AGE_MS) {
      return {
        data: cachedProperties,
        cacheStatus: 'STALE',
        stale: true,
      }
    }

    throw error
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({
      error: 'Method not allowed',
    })
  }

  try {
    const result = await getProperties()

    res.setHeader(
      'Cache-Control',
      'public, s-maxage=15, stale-while-revalidate=60'
    )
    res.setHeader('X-HostelSet-Cache', result.cacheStatus)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')

    return res.status(200).json(result.data)
  } catch (error) {
    console.error('[public-properties-api]', error)

    res.setHeader('Cache-Control', 'no-store')

    return res.status(503).json({
      error: 'Properties are temporarily unavailable. Please try again.',
    })
  }
}
