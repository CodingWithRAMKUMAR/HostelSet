import Head from 'next/head'
import Link from 'next/link'
import BrandLogo from '../components/BrandLogo'
import PublicFooter from '../components/PublicFooter'
import ThemeToggle from '../components/common/ThemeToggle'
import { FAQS } from '../lib/faqs'

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.hostelset.com').replace(/\/$/, '')

export default function FAQPage() {
  const schema = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQS.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) }).replace(/</g, '\\u003c')
  return <>
    <Head><title>Frequently Asked Questions | HostelSet</title><meta name="description" content="Answers about HostelSet applications, payments, properties, tenant management, notifications, complaints, and existing tenant imports."/><link rel="canonical" href={`${SITE_URL}/faq`}/><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }}/></Head>
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white"><div className="container mx-auto flex items-center justify-between px-4 py-4"><Link href="/" aria-label="HostelSet home"><BrandLogo priority /></Link><div className="flex items-center gap-3"><ThemeToggle/><Link href="/properties" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Browse properties</Link></div></div></header>
      <section className="container mx-auto px-4 py-12 sm:py-16"><div className="mx-auto max-w-3xl text-center"><p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">Help center</p><h1 className="mt-3 text-3xl font-bold sm:text-5xl">Frequently asked questions</h1><p className="mt-4 text-base leading-7 text-slate-600">Straightforward answers for owners, applicants, tenants, and administrators.</p></div><div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2">{FAQS.map(item => <article key={item.question} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-900">{item.question}</h2><p className="mt-3 leading-7 text-slate-600">{item.answer}</p></article>)}</div></section>
    </main><PublicFooter/>
  </>
}
