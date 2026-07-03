import Head from 'next/head'
import Link from 'next/link'

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://hostelset.com').replace(/\/$/, '')

export default function PublicInfoPage({ title, description, path, children }) {
  return (
    <>
      <Head>
        <title>{title} - HostelSet</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`${SITE_URL}${path}`} />
      </Head>
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm sm:p-10">
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          <div className="mt-6 space-y-5 leading-7 text-slate-700">{children}</div>
          <nav className="mt-8 flex flex-wrap gap-4" aria-label="Public pages">
            <Link href="/" className="font-semibold text-indigo-700 underline">Home</Link>
            <Link href="/properties" className="font-semibold text-indigo-700 underline">Browse properties</Link>
          </nav>
        </article>
      </main>
    </>
  )
}
