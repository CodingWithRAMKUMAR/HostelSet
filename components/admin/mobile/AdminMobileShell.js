import MobileTopbar from '../../dashboard/MobileTopbar'

export function AdminMobileHeader({ title, subtitle, avatar = 'A', onBack, onProfile }) {
  return <MobileTopbar title={title} subtitle={subtitle} isHome={!onBack} onBack={onBack} onProfile={onProfile} avatar={avatar} fallbackIcon="settings" />
}

export function AdminMobilePage({ title, subtitle, avatar = 'A', onBack, onProfile, children }) {
  return (
    <div className="min-h-dvh max-w-full overflow-x-hidden bg-slate-950 pb-[calc(5.1rem_+_env(safe-area-inset-bottom))]">
      <AdminMobileHeader title={title} subtitle={subtitle} avatar={avatar} onBack={onBack} onProfile={onProfile} />
      <main className="mx-auto max-w-md space-y-2 px-3 py-2">{children}</main>
    </div>
  )
}

export function AdminEmptyState({ children = 'Nothing to show yet.' }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-white p-3 text-center text-sm text-slate-500">{children}</div>
}

export function AdminLoadingState({ children = 'Loading…' }) {
  return <div className="rounded-2xl border border-white/10 bg-white p-3 text-sm text-slate-500 shadow-sm">{children}</div>
}

export function AdminStatusChip({ children, tone = 'slate' }) {
  const tones = {
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    orange: 'bg-orange-100 text-orange-700',
    slate: 'bg-slate-100 text-slate-700',
  }
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${tones[tone] || tones.slate}`}>{children}</span>
}
