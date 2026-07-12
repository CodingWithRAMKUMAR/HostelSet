const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { calculateCanonicalRentDue, anchoredDate } = require('../lib/rentDue')
const { resolveDashboardQuery } = require('../lib/dashboardRouting')
const { normalizePrivateDocumentPath, createExpiringRequestCache } = require('../lib/privateDocument')
const { isDashboardPath } = require('../lib/routeScope')

const id = '123e4567-e89b-42d3-a456-426614174000'
const tenant = { move_in_date:'2026-06-16', rent_amount:10000, status:'active' }
const due = (payments, now = new Date(2026,5,20)) => calculateCanonicalRentDue(tenant, payments, now)
const payment = (overrides = {}) => ({ id:crypto.randomUUID(), status:'success', payment_method:'upi', amount:10000, payment_date:'2026-07-16', ...overrides })

// Owner and Tenant call this same helper with the same tenant-specific records.
const records = [payment()]
assert.deepEqual(calculateCanonicalRentDue(tenant, records, new Date(2026,6,20)), calculateCanonicalRentDue(tenant, records, new Date(2026,6,20)))
assert.equal(due([]).dueDate.toDateString(), new Date(2026,6,16).toDateString())
assert.equal(due([], new Date(2026,6,16)).status, 'due_today')
assert.equal(due([], new Date(2026,6,20)).dueDate.toDateString(), new Date(2026,6,16).toDateString())
assert.equal(due(records, new Date(2026,6,20)).dueDate.toDateString(), new Date(2026,7,16).toDateString())
for (const excluded of [
  payment({payment_method:'security_deposit'}), payment({status:'payment_pending'}), payment({status:'rejected'}), payment({amount:5000}),
]) assert.equal(due([excluded]).dueDate.getMonth(), 6)
const duplicate = payment({ id:'same-payment' })
assert.equal(due([duplicate, duplicate]).dueDate.getMonth(), 7)
assert.equal(anchoredDate({year:2026,month:1,day:29},1).getDate(), 28)
assert.equal(anchoredDate({year:2026,month:1,day:30},1).getDate(), 28)
assert.equal(anchoredDate({year:2026,month:1,day:31},1).getDate(), 28)
assert.equal(anchoredDate({year:2024,month:1,day:31},1).getDate(), 29)

const mappings = {
  owner: { application:'applications', import:'existing-imports', payment:'rent-payments', complaint:'complaints', 'room-change':'room-change', vacate:'vacate', notice:'notices', membership:'membership', 'archived-tenant':'archived-tenants' },
  tenant: { payment:'payments', notice:'notices', complaint:'complaints', 'room-change':'room-change', vacate:'vacate' },
  admin: { property:'properties', membership:'membership', payment:'payments', application:'applications', complaint:'complaints', 'room-change':'roomchange', vacate:'vacate' },
}
const idKeys = { owner:{ applications:'application_id','existing-imports':'import_id','rent-payments':'payment_id',complaints:'complaint_id','room-change':'request_id',vacate:'request_id',notices:'notice_id',membership:'membership_id','archived-tenants':'tenant_id' }, tenant:{payments:'payment_id',notices:'notice_id',complaints:'complaint_id','room-change':'request_id',vacate:'request_id'}, admin:{properties:'property_id',membership:'membership_id',payments:'payment_id',applications:'application_id',complaints:'complaint_id',roomchange:'request_id',vacate:'request_id'} }
for (const [role, roleMappings] of Object.entries(mappings)) for (const [tab, expected] of Object.entries(roleMappings)) {
  const key = idKeys[role][expected]
  const resolved = resolveDashboardQuery(role, { tab, [key]:id })
  assert.equal(resolved.view, expected); assert.equal(resolved.recordId, id)
  assert.equal(resolveDashboardQuery(role, { tab, [key]:'not-a-uuid' }).recordId, null)
  assert.equal(resolveDashboardQuery(role, { tab:'unknown' }).view, 'overview')
}

assert.equal(normalizePrivateDocumentPath('tenant-documents/property/payments/proof.png'),'property/payments/proof.png')
for (const bad of ['', 'https://example.com/a', 'blob:x', 'data:image/png,x', '../secret', 'bad//path', 'bad?x=1']) assert.equal(normalizePrivateDocumentPath(bad),null)
assert.equal(isDashboardPath('/owner/dashboard'), true)
assert.equal(isDashboardPath('/tenant/dashboard'), true)
assert.equal(isDashboardPath('/admin/dashboard'), true)
for (const publicPath of ['/', '/property/example', '/properties', '/login/tenant', '/register', '/faq']) assert.equal(isDashboardPath(publicPath), false)

const source = relative => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8')
const propertySource = source('pages/property/[id].js')
assert.equal(propertySource.includes('absolute bottom-0 left-0 w-full h-0.5'), false, 'property tabs must not render a detached cross-card divider')
assert.equal(propertySource.includes("from '../../lib/supabase'"), false, 'public property must not initialize the persisted auth client')
assert.equal(source('pages/properties.js').includes("from '../lib/supabase'"), false, 'public browse must not initialize the persisted auth client')
const publicClientSource = source('lib/publicSupabase.js')
assert.match(publicClientSource, /persistSession:false/)
assert.match(publicClientSource, /autoRefreshToken:false/)
assert.match(source('pages/index.js'), /public-login-button/)
assert.match(source('styles/globals.css'), /\.dark \.public-login-button[\s\S]*background:#fff !important/)
assert.match(source('pages/_app.js'), /if \(!isDashboardRoute\) return undefined/)
assert.match(source('next.config.js'), /devIndicators:\s*false/)
const authSource = source('lib/supabase.js')
assert.match(authSource, /if \(sessionRestorePromise\) return sessionRestorePromise/)
assert.match(authSource, /staleSessionRecoveryComplete/)

;(async () => {
  let now = 0, calls = 0
  const cache = createExpiringRequestCache({ successTtlMs:100, missingTtlMs:50, now:() => now })
  const missing = async () => { calls += 1; return null }
  await Promise.all([cache.getOrLoad('missing', missing), cache.getOrLoad('missing', missing)])
  assert.equal(calls, 1, 'concurrent signing requests must deduplicate')
  await cache.getOrLoad('missing', missing); assert.equal(calls, 1, 'missing objects must be negatively cached')
  now = 51; await cache.getOrLoad('missing', missing); assert.equal(calls, 2, 'negative cache must be bounded')
  console.log('Reliability helper tests passed')
})().catch(error => { console.error(error); process.exitCode = 1 })
