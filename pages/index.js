import { useState } from 'react'
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
    <section id={id} className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-300">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-black tracking-tight text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
      <ul className="mt-5 grid gap-2 text-sm text-slate-200">
        {benefits.map(item => (
          <li key={item} className="flex gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isOwner ? 'bg-white' : 'bg-orange-400'}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">{children}</div>
    </section>
  )
}

function LoginChooser({ open, onClose }) {
  if (!open) return null
  return (
    <div className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl shadow-black/40">
      <Link onClick={onClose} href="/login/tenant" className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">Tenant Login</Link>
      <Link onClick={onClose} href="/login/owner" className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">Owner Login</Link>
      <Link onClick={onClose} href="/login/admin" className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">Admin Login</Link>
    </div>
  )
}

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false)

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

      <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.25),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.18),transparent_30%)]" />
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
            <Link href="/" aria-label="HostelSet home" className="shrink-0">
              <BrandLogo priority />
            </Link>
            <nav className="hidden items-center gap-5 text-sm font-semibold text-slate-300 lg:flex" aria-label="Public navigation">
              <Link href="/" className="hover:text-white">Home</Link>
              <Link href="/properties" className="hover:text-white">Browse Hostels</Link>
              <Link href="#for-tenants" className="hover:text-white">For Tenants</Link>
              <Link href="#for-owners" className="hover:text-white">For Owners</Link>
              <Link href="/faq" className="hover:text-white">FAQ</Link>
            </nav>
            <div className="relative">
              <button
                type="button"
                onClick={() => setLoginOpen(open => !open)}
                className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow-lg shadow-black/20 transition hover:bg-orange-100"
                aria-expanded={loginOpen}
                aria-haspopup="menu"
              >
                Login
              </button>
              <LoginChooser open={loginOpen} onClose={() => setLoginOpen(false)} />
            </div>
          </header>

          <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
            <div>
              <p className="inline-flex rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-orange-200">
                Hostel management + PG discovery
              </p>
              <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
                Manage hostels. Find better stays.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                HostelSet helps hostel owners manage rooms, tenants, rent, notices, and requests. Tenants can browse hostels, apply online, and access their account after approval.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href="/properties" className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-xl shadow-orange-950/30 transition hover:bg-orange-400">
                  Browse Hostels
                </Link>
                <Link href="/register" className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-5 py-3 text-sm font-black text-white transition hover:border-orange-300 hover:text-orange-200">
                  Register Your Property
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
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
                <Link href="/register" className="inline-flex flex-1 items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-orange-100">
                  Register Your Property
                </Link>
                <Link href="/login/owner" className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white transition hover:border-orange-300 hover:text-orange-200">
                  Owner Login
                </Link>
              </RoleCard>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            <h2 className="text-sm font-black uppercase tracking-[0.22em] text-orange-200">Tenant flow</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
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
