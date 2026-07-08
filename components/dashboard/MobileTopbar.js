import BrandLogo from '../BrandLogo'

export default function MobileTopbar({ title, subtitle, isHome, onBack, controls, onProfile, avatar = 'U' }) {
  return <header className="sticky top-0 z-50 border-b border-orange-500/30 bg-slate-950 text-white lg:hidden">
    <div className="flex min-h-14 w-full min-w-0 items-center gap-2 px-3 py-2">
      {isHome ? <div className="w-10 shrink-0 overflow-hidden"><BrandLogo size="mobile" priority /></div> : <button type="button" onClick={onBack} aria-label="Back to dashboard" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">←</button>}
      <div className="min-w-0 flex-1 text-center"><p className="truncate text-sm font-bold">{title}</p>{subtitle && <p className="truncate text-[11px] text-slate-400">{subtitle}</p>}</div>
      <div className="flex shrink-0 items-center gap-1">{controls}<button type="button" onClick={onProfile} aria-label="Open profile or more menu" className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">{avatar}</button></div>
    </div>
  </header>
}
