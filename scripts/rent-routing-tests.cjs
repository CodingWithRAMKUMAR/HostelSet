const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  calculateCanonicalRentDue,
  formatRentDueLabel,
} = require('../lib/rentDue')
const {
  classifyTenantRent,
  enrichTenantRentStatus,
} = require('../lib/tenantRentStatus')
const {
  buildDashboardHref,
  dashboardHrefToPath,
  pushDashboardHistory,
  replaceDashboardHistory,
  resolveDashboardQuery,
} = require('../lib/dashboardRouting')
const {
  normalizeIndianPhone,
  phoneLoginVariants,
  resolvePhoneLoginEmail,
} = require('../lib/server/phoneLogin')

const NOW = new Date(2026, 6, 16)
const tenant = (overrides = {}) => ({
  id: 'tenant-1',
  status: 'active',
  move_in_date: '2026-07-16',
  rent_amount: 1000,
  ...overrides,
})
const payment = (overrides = {}) => ({
  id: 'payment-1',
  tenant_id: 'tenant-1',
  amount: 1000,
  payment_date: '2026-07-16',
  payment_method: 'upi',
  status: 'success',
  ...overrides,
})
const localDate = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-')
const source = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
const asyncTests = []

function test(name, fn) {
  try {
    const result = fn()
    if (result && typeof result.then === 'function') {
      asyncTests.push(result.then(() => console.log(`ok - ${name}`)).catch(error => {
        console.error(`not ok - ${name}`)
        throw error
      }))
      return
    }
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

function fakeSupabase({ users = [], tenants = [] } = {}) {
  const tables = { users, tenants }
  return {
    from(tableName) {
      const rows = tables[tableName] || []
      const filters = []
      const builder = {
        select() { return builder },
        in(column, values) {
          filters.push(row => values.includes(row[column]))
          return builder
        },
        eq(column, value) {
          filters.push(row => row[column] === value)
          return builder
        },
        limit(count) {
          return Promise.resolve({ data: rows.filter(row => filters.every(filter => filter(row))).slice(0, count), error: null })
        },
        maybeSingle() {
          const matches = rows.filter(row => filters.every(filter => filter(row)))
          if (matches.length > 1) return Promise.resolve({ data: null, error: new Error('multiple rows') })
          return Promise.resolve({ data: matches[0] || null, error: null })
        },
      }
      return builder
    },
  }
}

test('unpaid due in 10 days is upcoming, not paid', () => {
  const result = calculateCanonicalRentDue(tenant({ move_in_date: '2026-07-26' }), [], NOW)
  assert.strictEqual(result.status, 'upcoming')
  assert.strictEqual(result.dueAmount, 1000)
})

test('unpaid due in 3 days is due soon', () => {
  const result = calculateCanonicalRentDue(tenant({ move_in_date: '2026-07-19' }), [], NOW)
  assert.strictEqual(result.status, 'due_soon')
})

test('unpaid due today is due today', () => {
  const result = calculateCanonicalRentDue(tenant(), [], NOW)
  assert.strictEqual(result.status, 'due_today')
})

test('unpaid due yesterday is overdue', () => {
  const result = calculateCanonicalRentDue(tenant({ move_in_date: '2026-07-15' }), [], NOW)
  assert.strictEqual(result.status, 'overdue')
})

test('confirmed full monthly rent is paid', () => {
  const result = calculateCanonicalRentDue(tenant(), [payment()], NOW)
  assert.strictEqual(result.status, 'paid')
  assert.strictEqual(result.dueAmount, 0)
})

test('partial confirmed payment leaves remaining due amount', () => {
  const result = calculateCanonicalRentDue(tenant(), [payment({ amount: 400 })], NOW)
  assert.strictEqual(result.status, 'due_today')
  assert.strictEqual(result.dueAmount, 600)
})

test('pending payment proof only is pending confirmation, not paid', () => {
  const result = calculateCanonicalRentDue(tenant(), [payment({ status: 'payment_pending' })], NOW)
  assert.strictEqual(result.status, 'pending_confirmation')
  assert.strictEqual(result.dueAmount, 1000)
})

test('successful security deposit does not count as monthly rent', () => {
  const result = calculateCanonicalRentDue(tenant(), [payment({ payment_method: 'security_deposit' })], NOW)
  assert.strictEqual(result.status, 'due_today')
  assert.strictEqual(result.dueAmount, 1000)
})

test('archived tenant is inactive', () => {
  const result = calculateCanonicalRentDue(tenant({ status: 'inactive' }), [payment()], NOW)
  assert.strictEqual(result.status, 'inactive')
  assert.strictEqual(result.dueAmount, 0)
})

test('multiple confirmed payments are not double-counted by payment id', () => {
  const duplicate = payment({ id: 'same-id' })
  const result = calculateCanonicalRentDue(tenant(), [duplicate, { ...duplicate }], NOW)
  assert.strictEqual(result.status, 'paid')
  assert.strictEqual(result.confirmedAmount, 1000)
})

test('month-end anchor clamps to the last valid day', () => {
  const result = calculateCanonicalRentDue(
    tenant({ move_in_date: '2026-01-31' }),
    [payment({ payment_date: '2026-01-31' })],
    new Date(2026, 1, 20)
  )
  assert.strictEqual(result.status, 'paid')
  assert.strictEqual(localDate(result.dueDate), '2026-02-28')
})

test('owner and tenant classification helpers return the same category', () => {
  const row = tenant({ move_in_date: '2026-07-16' })
  const owner = classifyTenantRent(row, [], NOW)
  const tenantSide = enrichTenantRentStatus(row, [], NOW)
  assert.strictEqual(owner.category, tenantSide.category)
  assert.strictEqual(owner.category, 'due')
})

test('owner valid tab generates canonical URL', () => {
  const href = buildDashboardHref('owner', 'tenants')
  assert.strictEqual(dashboardHrefToPath(href), '/owner/dashboard?tab=tenants')
})

test('tenant valid tab generates canonical URL', () => {
  const href = buildDashboardHref('tenant', 'payments')
  assert.strictEqual(dashboardHrefToPath(href), '/tenant/dashboard?tab=payments')
})

test('unknown tab safely falls back to overview', () => {
  const resolved = resolveDashboardQuery('owner', { tab: 'not-a-tab' })
  assert.strictEqual(resolved.view, 'overview')
  assert.strictEqual(dashboardHrefToPath(buildDashboardHref('owner', resolved.view)), '/owner/dashboard')
})

test('canonical URL generation preserves matching record ids', () => {
  const id = '11111111-1111-4111-8111-111111111111'
  const href = buildDashboardHref('owner', 'room-change', { request_id: id })
  assert.strictEqual(dashboardHrefToPath(href), `/owner/dashboard?tab=room-change&request_id=${id}`)
})

test('back and forward query resolution uses router query state', () => {
  assert.strictEqual(resolveDashboardQuery('tenant', { tab: 'payments' }).view, 'payments')
  assert.strictEqual(resolveDashboardQuery('tenant', {}).view, 'overview')
})

test('clicking the same tab resolves to the same canonical path', () => {
  const current = buildDashboardHref('owner', 'rooms')
  const next = buildDashboardHref('owner', 'rooms', current.query)
  assert.strictEqual(dashboardHrefToPath(current), dashboardHrefToPath(next))
})

test('dashboard routing uses shallow Next router methods, not full reload', () => {
  const calls = []
  const router = {
    push: (href, as, options) => calls.push(['push', href, as, options]),
    replace: (href, as, options) => calls.push(['replace', href, as, options]),
  }
  pushDashboardHistory(router, buildDashboardHref('owner', 'rooms'))
  replaceDashboardHistory(router, buildDashboardHref('owner', 'overview'))
  assert.strictEqual(calls.length, 2)
  assert.deepStrictEqual(calls[0][3], { shallow: true, scroll: false })
  assert.deepStrictEqual(calls[1][3], { shallow: true, scroll: false })
})

test('labels expose due today and pending confirmation clearly', () => {
  assert.strictEqual(formatRentDueLabel(calculateCanonicalRentDue(tenant(), [], NOW)), 'Due today')
  assert.strictEqual(formatRentDueLabel(calculateCanonicalRentDue(tenant(), [payment({ status: 'pending' })], NOW)), 'Pending confirmation')
})

test('phone login accepts supported Indian phone formats', () => {
  assert.strictEqual(normalizeIndianPhone('9876543210'), '9876543210')
  assert.strictEqual(normalizeIndianPhone('+91 98765-43210'), '9876543210')
  assert.strictEqual(normalizeIndianPhone('91 98765 43210'), '9876543210')
  assert.strictEqual(normalizeIndianPhone('(09876) 543210'), '9876543210')
  assert.strictEqual(normalizeIndianPhone('12345'), '')
  assert.deepStrictEqual(phoneLoginVariants('9876543210'), ['9876543210', '919876543210', '+919876543210'])
})

test('phone resolver returns a unique active users-table match', async () => {
  const result = await resolvePhoneLoginEmail({
    supabase: fakeSupabase({ users: [{ id: 'u1', email: 'user@example.com', phone: '+919876543210', is_active: true }] }),
    phone: '9876543210',
    logger: { warn() {} },
  })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.email, 'user@example.com')
  assert.strictEqual(result.source, 'users')
})

test('phone resolver falls back to an active tenant linked user', async () => {
  const result = await resolvePhoneLoginEmail({
    supabase: fakeSupabase({
      users: [{ id: 'u1', email: 'tenant@example.com', phone: '', is_active: true }],
      tenants: [{ id: 't1', user_id: 'u1', phone: '919876543210', status: 'active' }],
    }),
    phone: '+91 98765 43210',
    logger: { warn() {} },
  })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.email, 'tenant@example.com')
  assert.strictEqual(result.source, 'tenants')
})

test('phone resolver rejects duplicate active matches generically', async () => {
  const result = await resolvePhoneLoginEmail({
    supabase: fakeSupabase({
      users: [
        { id: 'u1', email: 'one@example.com', phone: '9876543210', is_active: true },
        { id: 'u2', email: 'two@example.com', phone: '+919876543210', is_active: true },
      ],
    }),
    phone: '9876543210',
    logger: { warn() {} },
  })
  assert.strictEqual(result.ok, false)
  assert.strictEqual(result.reason, 'duplicate_active_users')
  assert.strictEqual(result.publicMessage, 'No account found with this phone number.')
})

test('phone resolver rejects inactive accounts and archived tenants', async () => {
  const inactive = await resolvePhoneLoginEmail({
    supabase: fakeSupabase({ users: [{ id: 'u1', email: 'inactive@example.com', phone: '9876543210', is_active: false }] }),
    phone: '9876543210',
    logger: { warn() {} },
  })
  assert.strictEqual(inactive.ok, false)
  const archived = await resolvePhoneLoginEmail({
    supabase: fakeSupabase({
      users: [{ id: 'u1', email: 'tenant@example.com', phone: '', is_active: true }],
      tenants: [{ id: 't1', user_id: 'u1', phone: '9876543210', status: 'archived' }],
    }),
    phone: '9876543210',
    logger: { warn() {} },
  })
  assert.strictEqual(archived.ok, false)
})

test('phone login keeps rate limiting and service role server-side', () => {
  const apiSource = source('pages/api/auth/resolve-phone.js')
  const loginSource = source('pages/login.js')
  assert.match(apiSource, /phone-resolution-ip/)
  assert.match(apiSource, /phone-resolution-phone/)
  assert.match(apiSource, /identifier: normalizedPhone/)
  assert.strictEqual(loginSource.includes('SUPABASE_SERVICE_ROLE_KEY'), false)
  assert.strictEqual(apiSource.includes('.maybeSingle()'), false)
})

test('email login path remains unchanged and phone errors are not duplicated visibly', () => {
  const loginSource = source('pages/login.js')
  assert.match(loginSource, /const result = await signInWithEmail\(emailToUse, password\)/)
  assert.match(loginSource, /if \(isPhone\(identifier\)\)/)
  assert.match(loginSource, /else if \(!isEmail\(identifier\)\)/)
  assert.strictEqual((loginSource.match(/No account found with this phone number\./g) || []).length, 1)
})

test('mobile tenants layout does not require horizontal scrolling', () => {
  const mobileTenants = source('components/owner/mobile/OwnerMobileTenants.js')
  assert.strictEqual(mobileTenants.includes('overflow-x-auto'), false)
  assert.strictEqual(mobileTenants.includes('shrink-0 rounded-full px-3'), false)
  assert.match(mobileTenants, /grid grid-cols-3 gap-1/)
  assert.match(mobileTenants, /min-\[380px\]:grid-cols-5/)
})

test('mobile tenant summary totals are shown only once', () => {
  const mobileTenants = source('components/owner/mobile/OwnerMobileTenants.js')
  assert.strictEqual((mobileTenants.match(/role="tablist"/g) || []).length, 1)
  assert.match(mobileTenants, /SUMMARY_FILTERS\.map/)
  assert.strictEqual(mobileTenants.includes('{counts[item]}'), false)
})

test('top mobile tenant summary buttons perform filtering', () => {
  const mobileTenants = source('components/owner/mobile/OwnerMobileTenants.js')
  assert.match(mobileTenants, /const SUMMARY_FILTERS = \[/)
  assert.match(mobileTenants, /\['all', 'Total'\]/)
  assert.match(mobileTenants, /\['due', 'Due'\]/)
  assert.match(mobileTenants, /\['pending_confirmation', 'Pending'\]/)
  assert.match(mobileTenants, /\['paid', 'Paid'\]/)
  assert.match(mobileTenants, /\['upcoming', 'Upcoming'\]/)
  assert.match(mobileTenants, /onClick=\{\(\) => setFilter\(item\)\}/)
})

test('active mobile tenant summary state updates clearly', () => {
  const mobileTenants = source('components/owner/mobile/OwnerMobileTenants.js')
  assert.match(mobileTenants, /aria-selected=\{active\}/)
  assert.match(mobileTenants, /active \? 'border-orange-400 bg-orange-500 text-white'/)
})

test('mobile tenant filters remain usable at 320px width', () => {
  const mobileTenants = source('components/owner/mobile/OwnerMobileTenants.js')
  assert.match(mobileTenants, /min-h-11 min-w-0 rounded-xl/)
  assert.match(mobileTenants, /aria-label=\{`Show \$\{label\.toLowerCase\(\)\} tenants: \$\{value\}`\}/)
})

test('mobile tenant card markup is compact', () => {
  const mobileTenants = source('components/owner/mobile/OwnerMobileTenants.js')
  assert.strictEqual(mobileTenants.includes('min-h-[82px]'), false)
  assert.strictEqual(mobileTenants.includes('rounded-3xl border border-white/10 bg-white p-2.5'), false)
  assert.match(mobileTenants, /min-h-\[64px\]/)
  assert.match(mobileTenants, /h-8 w-8 shrink-0 rounded-full/)
})

test('owner section navigation keeps shell visible and avoids blank dynamic sections', () => {
  const ownerDashboard = source('pages/owner/dashboard.js')
  assert.match(ownerDashboard, /<MobileBottomNav items=\{ownerBottomItems\}/)
  assert.match(ownerDashboard, /function OwnerSectionSkeleton/)
  assert.match(ownerDashboard, /loading: sectionLoading/)
  assert.strictEqual(ownerDashboard.includes('setLoading(true); setActiveTab'), false)
})

test('owner valid tab click updates visible tab before shallow routing', () => {
  const ownerDashboard = source('pages/owner/dashboard.js')
  const openSection = ownerDashboard.match(/const openSection = \(tab\) => \{[\s\S]*?\n  \};/)?.[0] || ''
  assert.ok(openSection.indexOf('setActiveTab(nextTab);') > -1)
  assert.ok(openSection.indexOf('pushDashboardHistory(router, href)') > -1)
  assert.ok(openSection.indexOf('setActiveTab(nextTab);') < openSection.indexOf('pushDashboardHistory(router, href)'))
  assert.match(openSection, /requestAnimationFrame\(\(\) => \{[\s\S]*pushDashboardHistory\(router, href\)/)
})

test('first visit to a main owner mobile tab mounts it immediately', () => {
  const ownerDashboard = source('pages/owner/dashboard.js')
  assert.match(ownerDashboard, /const MAIN_OWNER_MOBILE_TABS = \[/)
  assert.match(ownerDashboard, /mountedMobileTabs\.has\(tab\) \|\| tab === activeTab/)
})

test('returning to a visited owner mobile tab does not remount it', () => {
  const ownerDashboard = source('pages/owner/dashboard.js')
  assert.match(ownerDashboard, /const \[mountedMobileTabs, setMountedMobileTabs\] = useState\(\(\) => new Set/)
  assert.match(ownerDashboard, /if \(previous\.has\(activeTab\)\) return previous/)
  assert.match(ownerDashboard, /const next = new Set\(previous\)/)
})

test('switching main owner mobile tabs never renders an empty content container', () => {
  const ownerDashboard = source('pages/owner/dashboard.js')
  assert.match(ownerDashboard, /data-owner-mobile-mounted-tabs/)
  assert.match(ownerDashboard, /data-owner-mobile-tab=\{tab\}/)
  assert.match(ownerDashboard, /<OwnerMobileTabPanel key=\{tab\} tab=\{tab\} active=\{activeTab === tab\}>/)
  assert.match(ownerDashboard, /hidden=\{!active\}/)
})

test('owner same-tab click does not trigger reload or refetch', () => {
  const ownerDashboard = source('pages/owner/dashboard.js')
  const sameTabBlock = ownerDashboard.match(/if \(!router\.isReady \|\| nextTab === activeTab\) \{[\s\S]*?\n    \}/)?.[0] || ''
  assert.match(sameTabBlock, /setMobileMenu\(null\)/)
  assert.match(sameTabBlock, /setProfileMenuOpen\(false\)/)
  assert.match(sameTabBlock, /return/)
  assert.strictEqual(sameTabBlock.includes('pushDashboardHistory'), false)
  assert.strictEqual(sameTabBlock.includes('loadData('), false)
})

test('owner browser back and forward still resolve correct section', () => {
  assert.strictEqual(resolveDashboardQuery('owner', { tab: 'rooms' }).view, 'rooms')
  assert.strictEqual(resolveDashboardQuery('owner', { tab: 'tenants' }).view, 'tenants')
  assert.strictEqual(resolveDashboardQuery('owner', { tab: 'rent-payments' }).view, 'rent-payments')
})

test('active tab changes do not refetch owner core data', () => {
  const ownerDashboard = source('pages/owner/dashboard.js')
  assert.strictEqual(/useEffect\([\s\S]*?loadData\([\s\S]*?\], \[[^\]]*activeTab/.test(ownerDashboard), false)
})

test('owner mobile tab data derivations are memoized instead of recomputed every render', () => {
  const ownerDashboard = source('pages/owner/dashboard.js')
  for (const name of [
    'filteredRooms',
    'tenantsWithPhotos',
    'searchedTenants',
    'tenantRentCounts',
    'filteredPendingPayments',
    'filteredAllPayments',
    'searchGroups',
    'mobileOverviewCounts',
  ]) {
    assert.match(ownerDashboard, new RegExp(`const ${name} = useMemo`))
  }
  assert.strictEqual(/const filteredRooms = safeRooms\.filter/.test(ownerDashboard), false)
})

test('heavy owner mobile sections have memo boundaries for hidden mounted tabs', () => {
  for (const file of [
    'components/owner/mobile/OwnerMobileDashboard.js',
    'components/owner/mobile/OwnerMobileRooms.js',
    'components/owner/mobile/OwnerMobileTenants.js',
    'components/owner/mobile/OwnerMobilePayments.js',
  ]) {
    const mobileSource = source(file)
    assert.match(mobileSource, /import \{[^}]*memo/)
    assert.match(mobileSource, /export default memo\(/)
  }
})

test('owner mobile hidden tabs receive stable callback props where possible', () => {
  const ownerDashboard = source('pages/owner/dashboard.js')
  assert.match(ownerDashboard, /function useStableCallback/)
  assert.match(ownerDashboard, /const openSectionStable = useStableCallback\(openSection\)/)
  assert.match(ownerDashboard, /const navigateDashboardBackStable = useStableCallback\(navigateDashboardBack\)/)
  assert.match(ownerDashboard, /onNavigate=\{openSectionStable\}/)
  assert.match(ownerDashboard, /onBack=\{navigateDashboardBackStable\}/)
})

test('owner mobile navigation profiler is opt-in and development-only', () => {
  const ownerDashboard = source('pages/owner/dashboard.js')
  assert.match(ownerDashboard, /function markOwnerPerf/)
  assert.match(ownerDashboard, /hostelsetOwnerPerf/)
  assert.match(ownerDashboard, /process\.env\.NODE_ENV === 'production' && !\['localhost', '127\.0\.0\.1'\]/)
  assert.match(ownerDashboard, /visible-commit/)
  assert.match(ownerDashboard, /router-push-start/)
  assert.match(ownerDashboard, /router-push-finish/)
})

test('rent reminder worker repairs before-due and due-today queue rows without resending completed reminders', () => {
  const repositorySource = source('supabase/functions/_shared/supabase-rent-reminder-repository.ts')
  const scheduleSource = source('supabase/functions/_shared/rent-reminder-schedule.ts')
  assert.match(repositorySource, /repairReadyInitialReminders/)
  assert.match(repositorySource, /\.in\("due_date", \[today, beforeDueDate\]\)/)
  assert.match(repositorySource, /resettable = new Set\(\["pending", "failed", "cancelled"\]\)/)
  assert.match(repositorySource, /onConflict: "rent_id,reminder_type,reminder_sequence"/)
  assert.match(scheduleSource, /reminder_type: "before_due"/)
  assert.match(scheduleSource, /reminder_type: "due_today"/)
  assert.match(scheduleSource, /rent\.due_date === beforeDueDate/)
  assert.match(scheduleSource, /rent\.due_date === today/)
})

test('rent reminder dry-run is authorized, read-only, and does not call Brevo', () => {
  const functionSource = source('supabase/functions/process-rent-reminders/index.ts')
  const dryRunSource = source('supabase/functions/_shared/rent-reminder-dry-run.ts')
  assert.match(functionSource, /if \(!authorized\(request\)\) return json\(\{ error: "Unauthorized" \}, 401\)/)
  assert.match(functionSource, /if \(body\.dryRun\)/)
  assert.ok(functionSource.indexOf('if (body.dryRun)') < functionSource.indexOf('const emailService = createBrevoEmailService'))
  assert.strictEqual(dryRunSource.includes('.upsert('), false)
  assert.strictEqual(dryRunSource.includes('.update('), false)
  assert.strictEqual(dryRunSource.includes('.insert('), false)
  assert.strictEqual(dryRunSource.includes('BREVO_API_KEY'), false)
  assert.match(dryRunSource, /tenantEmailPresent/)
  assert.match(dryRunSource, /tenantEmailDomain/)
  assert.strictEqual(dryRunSource.includes('tenantName'), false)
})

test('rent reminder template names match database and Brevo mapping', () => {
  const typesSource = source('supabase/functions/_shared/rent-reminder-types.ts')
  const brevoSource = source('supabase/functions/_shared/brevo-email-service.ts')
  const dryRunSource = source('supabase/functions/_shared/rent-reminder-dry-run.ts')
  for (const type of ['before_due', 'due_today', 'overdue_2_days', 'weekly_overdue']) {
    assert.match(typesSource, new RegExp(`"${type}"`))
    assert.match(brevoSource, new RegExp(`${type}: positiveInteger`))
    assert.match(dryRunSource, new RegExp(`${type}`))
  }
  for (const envName of ['BREVO_RENT_BEFORE_DUE_TEMPLATE_ID', 'BREVO_RENT_DUE_TODAY_TEMPLATE_ID', 'BREVO_RENT_OVERDUE_2_DAYS_TEMPLATE_ID', 'BREVO_RENT_WEEKLY_OVERDUE_TEMPLATE_ID']) {
    assert.match(brevoSource, new RegExp(envName))
    assert.match(dryRunSource, new RegExp(envName))
  }
})

Promise.all(asyncTests).catch(error => {
  console.error(error)
  process.exitCode = 1
})
