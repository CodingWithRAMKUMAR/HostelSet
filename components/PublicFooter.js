import Link from 'next/link'
import BrandLogo from './BrandLogo'

const footerGroups = [
  {
    title: 'For Tenants',
    links: [
      ['Browse Hostels', '/properties'],
      ['How Applications Work', '/faq'],
      ['Tenant Login', '/login/tenant'],
      ['FAQ', '/faq'],
    ],
  },
  {
    title: 'For Owners',
    links: [
      ['Register Your Property', '/register'],
      ['Owner Login', '/login/owner'],
      ['Features for Owners', '/#for-owners'],
      ['Support', '/support'],
    ],
  },
  {
    title: 'Company / Legal',
    links: [
      ['About', '/about'],
      ['Contact / Support', '/contact'],
      ['Privacy Policy', '/privacy-policy'],
      ['Terms and Conditions', '/terms'],
      ['FAQ', '/faq'],
    ],
  },
  {
    title: 'Admin',
    links: [
      ['Admin Login', '/login/admin'],
    ],
  },
]

export default function PublicFooter({ dark = false }) {
  const year = new Date().getFullYear()
  const shell = dark ? 'border-t border-white/10 bg-slate-950 text-slate-300' : 'mt-12 border-t border-slate-200 bg-white text-slate-600'
  const muted = dark ? 'text-slate-400' : 'text-slate-500'
  const heading = dark ? 'text-white' : 'text-slate-900'
  const linkClass = dark ? 'text-slate-400 hover:text-orange-200' : 'text-slate-600 hover:text-indigo-700'

  return (
    <footer className={`${shell} w-full overflow-hidden py-8 sm:py-10`}>
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] lg:px-8">
        <div className="min-w-0">
          <Link href="/" aria-label="HostelSet home" className="inline-flex max-w-[150px]">
            <BrandLogo size="footer" />
          </Link>
          <p className={`mt-4 max-w-sm text-sm leading-6 ${muted}`}>
            HostelSet helps hostel owners manage rooms, tenants, rent, notices, and requests while helping tenants browse hostels and apply online.
          </p>
          <p className={`mt-5 text-xs ${muted}`}>© {year} HostelSet. All rights reserved.</p>
        </div>

        {footerGroups.map(group => (
          <nav key={group.title} aria-label={group.title} className="min-w-0">
            <h2 className={`text-sm font-black ${heading}`}>{group.title}</h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              {group.links.map(([label, href]) => (
                <li key={`${group.title}-${href}`}>
                  <Link href={href} className={linkClass}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  )
}
