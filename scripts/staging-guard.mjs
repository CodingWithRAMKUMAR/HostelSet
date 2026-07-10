import fs from 'fs'

function loadLocalEnv() {
  if (!fs.existsSync('.env.local')) return
  const lines = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    const value = match[2].trim()
    if (!process.env[key]) process.env[key] = value
  }
}

loadLocalEnv()

function readEnv(name) {
  return String(process.env[name] || '').trim()
}

export function getSupabaseProjectRef(url = readEnv('NEXT_PUBLIC_SUPABASE_URL')) {
  try {
    const host = new URL(url).host
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i)
    return match ? match[1] : ''
  } catch {
    return ''
  }
}

export function assertSafeStagingEnvironment({ requireSeedApproval = false } = {}) {
  const hostelsetEnv = readEnv('HOSTELSET_ENV')
  const configuredRef = readEnv('HOSTELSET_STAGING_PROJECT_REF')
  const connectedRef = getSupabaseProjectRef()
  const appEnv = readEnv('NEXT_PUBLIC_APP_ENV')

  const failures = []
  if (hostelsetEnv !== 'staging') failures.push('HOSTELSET_ENV must be exactly "staging".')
  if (appEnv === 'production') failures.push('NEXT_PUBLIC_APP_ENV must not be "production".')
  if (!configuredRef) failures.push('HOSTELSET_STAGING_PROJECT_REF is required.')
  if (!connectedRef) failures.push('NEXT_PUBLIC_SUPABASE_URL must point to a Supabase project URL.')
  if (configuredRef && connectedRef && configuredRef !== connectedRef) {
    failures.push('Connected Supabase project ref does not match HOSTELSET_STAGING_PROJECT_REF.')
  }
  if (!readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')) failures.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required.')
  if (!readEnv('SUPABASE_SERVICE_ROLE_KEY')) failures.push('SUPABASE_SERVICE_ROLE_KEY is required server-side.')
  if (!readEnv('API_RATE_LIMIT_SECRET')) failures.push('API_RATE_LIMIT_SECRET is required.')
  if (requireSeedApproval && readEnv('HOSTELSET_ALLOW_STAGING_SEED') !== 'true') {
    failures.push('HOSTELSET_ALLOW_STAGING_SEED must be exactly "true" to seed QA data.')
  }

  if (failures.length) {
    const error = new Error(`Refusing to continue:\n- ${failures.join('\n- ')}`)
    error.failures = failures
    throw error
  }

  return {
    hostelsetEnv,
    connectedProjectRef: connectedRef,
    configuredProjectRef: configuredRef,
    seedApproved: readEnv('HOSTELSET_ALLOW_STAGING_SEED') === 'true',
  }
}
