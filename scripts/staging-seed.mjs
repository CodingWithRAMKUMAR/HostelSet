import { assertSafeStagingEnvironment } from './staging-guard.mjs'

try {
  const result = assertSafeStagingEnvironment({ requireSeedApproval: true })
  console.log(`Staging seed guard passed for Supabase project ref: ${result.connectedProjectRef}`)
  console.log('Seed execution is intentionally not implemented in this sprint.')
  console.log('Follow docs/QA_TEST_DATA.md to implement idempotent QA seed records with credentials supplied outside Git.')
  process.exit(2)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
