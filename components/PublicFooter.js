import Link from 'next/link'

const links = [
  ['Privacy Policy', '/privacy-policy'], ['Terms', '/terms'],
  ['Refund Policy', '/refund-policy'], ['About', '/about'],
  ['Contact', '/contact'], ['Support', '/support'],
]

export default function PublicFooter({ dark = false }) {
  return <footer className={dark ? 'border-t border-gray-800 bg-gray-950 py-8' : 'mt-12 border-t border-slate-200 bg-white py-8'}><div className="container mx-auto px-4 text-center"><nav className="flex flex-wrap justify-center gap-x-5 gap-y-3 text-sm" aria-label="Legal and support">{links.map(([label, href]) => <Link key={href} href={href} className={dark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-indigo-700'}>{label}</Link>)}</nav><p className={dark ? 'mt-5 text-sm text-gray-600' : 'mt-5 text-sm text-slate-500'}>&copy; 2026 HostelSet. All rights reserved.</p></div></footer>
}
