import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import BrandLogo from '../components/BrandLogo'
import PublicFooter from '../components/PublicFooter'

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.hostelset.com').replace(/\/$/, '')
const HOME_TITLE = 'HostelSet | Hostel Management Software & PG Discovery Platform'
const HOME_DESCRIPTION = 'HostelSet is hostel management software for owners and a PG discovery and tenant application platform for students, workers, and renters.'
const HOME_KEYWORDS = 'hostel management software, PG management software, hostel and PG discovery, tenant application platform, property management for hostel owners, rent management, hostel owner dashboard'

const tenantBenefits = [
  'Browse hostels and PGs',
  'Compare rooms, rent, and facilities',
  'Apply directly to a property',
  'Receive account access after approval',
]

const ownerBenefits = [
  'Register and manage properties',
  'Add rooms and tenants',
  'Track rent and deposits',
  'Review applications and requests',
]

const tenantFlow = ['Browse Hostels', 'View Property', 'Apply', 'Owner Approval', 'Receive Account', 'Tenant Login']

function RoleCard({ id, eyebrow, title, description, benefits, children, accent = 'orange' }) {
  const isOwner = accent === 'white'
  return (
    <section id={id} className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/20 backdrop-blur sm:rounded-[2rem] sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-300">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:mt-3 sm:text-2xl">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
      <ul className="mt-4 grid gap-1.5 text-sm text-slate-200 sm:mt-5 sm:gap-2">
        {benefits.map(item => (
          <li key={item} className="flex gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isOwner ? 'bg-white' : 'bg-orange-400'}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:gap-3">{children}</div>
    </section>
  )
}

function LoginChooser({ open, onClose }) {
  if (!open) return null
  return (
    <div className="absolute right-0 top-full z-[120] mt-2 w-56 rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl shadow-black/40">
      <Link onClick={onClose} href="/login/tenant" className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">Tenant Login</Link>
      <Link onClick={onClose} href="/login/owner" className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">Owner Login</Link>
      <Link onClick={onClose} href="/login/admin" className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">Admin Login</Link>
    </div>
  )
}

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false)
  const loginRef = useRef(null)

  useEffect(() => {
    if (!loginOpen) return undefined
    const close = event => {
      if (event.key === 'Escape' || (event.type === 'pointerdown' && !loginRef.current?.contains(event.target))) setLoginOpen(false)
    }
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', close)
    return () => {
      document.removeEventListener('keydown', close)
      document.removeEventListener('pointerdown', close)
    }
  }, [loginOpen])

  return (
    <>
      <Head>
        <title>{HOME_TITLE}</title>
        <meta name="description" content={HOME_DESCRIPTION} />
        <meta name="keywords" content={HOME_KEYWORDS} />
        <link rel="canonical" href={SITE_URL} />
        <meta property="og:title" content={HOME_TITLE} />
        <meta property="og:description" content={HOME_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={HOME_TITLE} />
        <meta name="twitter:description" content={HOME_DESCRIPTION} />
      </Head>

      <main className="relative isolate min-h-screen overflow-x-hidden bg-slate-950 text-white">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.25),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.18),transparent_30%)]" />
        <div className="relative mx-auto w-full max-w-7xl px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
          <header className="relative z-[100] grid grid-cols-[auto_auto] items-center justify-between gap-3 overflow-visible rounded-3xl border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur sm:rounded-full sm:px-4 sm:py-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
            <Link href="/" aria-label="HostelSet home" className="shrink-0">
              <BrandLogo priority />
            </Link>
            <nav className="hidden min-w-0 items-center justify-center gap-4 text-sm font-semibold text-slate-300 xl:gap-5 lg:flex" aria-label="Public navigation">
              <Link href="/" className="hover:text-white">Home</Link>
              <Link href="/properties" className="hover:text-white">Browse Hostels</Link>
              <Link href="#for-tenants" className="hover:text-white">For Tenants</Link>
              <Link href="#for-owners" className="hover:text-white">For Owners</Link>
              <Link href="/faq" className="hover:text-white">FAQ</Link>
            </nav>
            <div ref={loginRef} className="relative justify-self-end">
              <button
                type="button"
                onClick={() => setLoginOpen(open => !open)}
                className="public-login-button rounded-full px-4 py-2 text-sm font-black shadow-lg shadow-black/20 transition"
                aria-expanded={loginOpen}
                aria-haspopup="menu"
              >
                Login
              </button>
              <LoginChooser open={loginOpen} onClose={() => setLoginOpen(false)} />
            </div>
          </header>

          <section className="relative z-10 grid items-start gap-5 py-5 sm:gap-8 sm:py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-14">
            <div>
              <p className="inline-flex rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-orange-200 sm:text-xs sm:tracking-[0.22em]">
                Hostel management + PG discovery
              </p>
              <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:mt-5 sm:text-6xl lg:text-7xl">
                Manage hostels. Find better stays.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:mt-5 sm:text-lg sm:leading-7">
                HostelSet helps hostel owners manage rooms, tenants, rent, notices, and requests. Tenants can browse hostels, apply online, and access their account after approval.
              </p>
              <div className="mt-5 flex flex-col gap-2.5 sm:mt-7 sm:flex-row sm:gap-3">
                <Link href="/properties" className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-xl shadow-orange-950/30 transition hover:bg-orange-400">
                  Browse Hostels
                </Link>
                <Link href="/register" className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-5 py-3 text-sm font-black text-white transition hover:border-orange-300 hover:text-orange-200">
                  Register Your Property
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4">
              <RoleCard
                id="for-tenants"
                eyebrow="For tenants"
                title="I'm looking for a hostel"
                description="Find a suitable hostel or PG, apply from the property page, then log in only after approval."
                benefits={tenantBenefits}
              >
                <Link href="/properties" className="inline-flex flex-1 items-center justify-center rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white transition hover:bg-orange-400">
                  Browse Hostels
                </Link>
                <Link href="/login/tenant" className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white transition hover:border-orange-300 hover:text-orange-200">
                  Tenant Login
                </Link>
                <p className="text-xs leading-relaxed text-amber-100/90 sm:col-span-2">
                  New tenants do not register directly. Apply to a hostel first or use an account created by your property owner.
                </p>
              </RoleCard>

              <RoleCard
                id="for-owners"
                eyebrow="For owners"
                title="I manage a hostel or PG"
                description="Create your owner account, submit your property details, and manage operations from one dashboard."
                benefits={ownerBenefits}
                accent="white"
              >
                  <Link href="/register" className="inline-flex flex-1 items-center justify-center rounded-2xl border border-orange-500 bg-orange-500 px-4 py-3 text-sm font-black text-white opacity-100 transition hover:border-orange-400 hover:bg-orange-400 active:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300">
                  Register Your Property
                </Link>
                <Link href="/login/owner" className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white transition hover:border-orange-300 hover:text-orange-200">
                  Owner Login
                </Link>
              </RoleCard>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-3 sm:rounded-[2rem] sm:p-5">
            <h2 className="text-sm font-black uppercase tracking-[0.22em] text-orange-200">Tenant flow</h2>
            <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-3 lg:grid-cols-6">
              {tenantFlow.map((step, index) => (
                <div key={step} className="rounded-2xl bg-slate-900/80 p-3 text-sm font-bold text-slate-100 ring-1 ring-white/10">
                  <span className="text-xs text-orange-300">0{index + 1}</span>
                  <p className="mt-1">{step}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
        <PublicFooter dark />
      </main>
    </>
  )
}
