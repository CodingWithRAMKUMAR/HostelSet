import NotificationBell from '../../common/NotificationBell'

export function AdminMobileHeader({ title, subtitle, avatar = 'A', onBack, onProfile }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 px-3 pt-[calc(env(safe-area-inset-top)_+_0.375rem)] pb-1.5 text-white">
      <div className="flex min-h-[46px] items-center gap-2">
        {onBack ? (
          <button type="button" onClick={onBack} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg" aria-label="Back">
            &larr;
          </button>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-sm font-black">HS</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-black leading-tight">{title}</p>
          {subtitle && <p className="truncate text-[10px] font-medium leading-tight text-slate-400">{subtitle}</p>}
        </div>
        <NotificationBell listenForGlobalOpen />
        <button type="button" onClick={onProfile} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-sm font-bold" aria-label="Open account menu">
          {avatar}
        </button>
      </div>
    </header>
  )
}

export function AdminMobilePage({ title, subtitle, avatar = 'A', onBack, onProfile, children }) {
  return (
    <div className="min-h-dvh max-w-full overflow-x-hidden bg-slate-50 pb-[calc(5.75rem_+_env(safe-area-inset-bottom))]">
      <AdminMobileHeader title={title} subtitle={subtitle} avatar={avatar} onBack={onBack} onProfile={onProfile} />
      <main className="mx-auto max-w-md space-y-2.5 px-3 py-2.5">{children}</main>
    </div>
  )
}

export function AdminEmptyState({ children = 'Nothing to show yet.' }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-500">{children}</div>
}

export function AdminLoadingState({ children = 'Loading…' }) {
  return <div className="rounded-2xl border border-slate-100 bg-white p-3 text-sm text-slate-500 shadow-sm">{children}</div>
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
