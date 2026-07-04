import toast from 'react-hot-toast'

export default function ExistingTenantImportSettings({ link, property, busy, onGenerate, onToggle }) {
  const url = link?.token && typeof window !== 'undefined' ? `${window.location.origin}/import/${link.token}` : ''
  const copy = async () => { await navigator.clipboard.writeText(url); toast.success('Import link copied') }
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-semibold text-slate-900">Existing Tenant Import Link</h2>
    <p className="mt-1 text-sm text-slate-600">A private, property-specific onboarding link for current residents of {property.name}.</p>
    {!link ? <button disabled={busy} onClick={onGenerate} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50">{busy ? 'Generating…' : 'Generate import link'}</button> : <div className="mt-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row"><input readOnly value={url} aria-label="Existing tenant import link" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm" /><button disabled={!link.is_active} onClick={copy} className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50">Copy link</button></div>
      <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => { if (confirm('Regenerate this link? The old link will stop working immediately.')) onGenerate() }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50">Regenerate</button><button disabled={busy} onClick={() => onToggle(!link.is_active)} className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${link.is_active ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{link.is_active ? 'Disable link' : 'Enable link'}</button><span className={`self-center rounded-full px-3 py-1 text-xs font-semibold ${link.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{link.is_active ? 'Active' : 'Disabled'}</span></div>
    </div>}
  </section>
}
