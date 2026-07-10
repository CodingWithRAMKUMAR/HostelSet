import { assertSafeStagingEnvironment } from './staging-guard.mjs'

try {
  const result = assertSafeStagingEnvironment()
  console.log(`Staging environment check passed for Supabase project ref: ${result.connectedProjectRef}`)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
