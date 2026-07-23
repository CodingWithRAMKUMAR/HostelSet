import http from 'k6/http'
import { check } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const RATE = Number(__ENV.RATE || 100)
const DURATION = __ENV.DURATION || '2m'
const PRE_ALLOCATED_VUS = Number(__ENV.PRE_ALLOCATED_VUS || 100)
const MAX_VUS = Number(__ENV.MAX_VUS || 500)

const apiDuration = new Trend('public_properties_api_duration', true)
const apiErrors = new Rate('public_properties_api_errors')
const cacheHits = new Counter('public_properties_cache_hits')
const cacheMisses = new Counter('public_properties_cache_misses')
const cacheStale = new Counter('public_properties_cache_stale')
const unknownCache = new Counter('public_properties_cache_unknown')

export const options = {
  scenarios: {
    cached_public_properties: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: PRE_ALLOCATED_VUS,
      maxVUs: MAX_VUS,
      gracefulStop: '30s',
    },
  },

  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    public_properties_api_errors: ['rate<0.01'],
    public_properties_api_duration: ['p(95)<1000'],
    dropped_iterations: ['count==0'],
  },
}

export default function () {
  const response = http.get(`${BASE_URL}/api/public/properties`, {
    headers: {
      Accept: 'application/json',
    },
    tags: {
      endpoint: 'public_properties_api',
    },
    timeout: '15s',
  })

  apiDuration.add(response.timings.duration)

  let validJson = false
  let propertyData = null

  try {
    propertyData = response.json()
    validJson = Array.isArray(propertyData)
  } catch (_) {
    validJson = false
  }

  const successful = check(response, {
    'API status is 200': res => res.status === 200,
    'API response is JSON array': () => validJson,
    'API response completed under 2 seconds': res =>
      res.timings.duration < 2000,
  })

  apiErrors.add(!successful)

  const cacheStatus = String(
    response.headers['X-HostelSet-Cache'] ||
    response.headers['X-Hostelset-Cache'] ||
    ''
  ).toUpperCase()

  if (cacheStatus === 'HIT') {
    cacheHits.add(1)
  } else if (cacheStatus === 'MISS') {
    cacheMisses.add(1)
  } else if (cacheStatus === 'STALE') {
    cacheStale.add(1)
  } else {
    unknownCache.add(1)
  }
}
