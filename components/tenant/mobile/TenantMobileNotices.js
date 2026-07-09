import NotificationBell from '../../common/NotificationBell'
import { formatDate } from '../../../lib/utils'

function Header({ onBack, title, subtitle, avatar, onProfile }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 px-3 pt-[calc(env(safe-area-inset-top)_+_0.375rem)] pb-1.5 text-white">
      <div className="flex min-h-[46px] items-center gap-2">
        <button type="button" onClick={onBack} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg" aria-label="Back">&larr;</button>
        <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-black leading-tight">{title}</p>{subtitle && <p className="truncate text-[10px] font-medium leading-tight text-slate-400">{subtitle}</p>}</div>
        <NotificationBell listenForGlobalOpen />
        <button type="button" onClick={onProfile} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-sm font-bold" aria-label="Open account menu">{avatar}</button>
      </div>
    </header>
  )
}

export default function TenantMobileNotices({ notices = [], property, avatar = 'U', onBack, onProfile }) {
  return (
    <div className="min-h-dvh max-w-full overflow-x-hidden bg-slate-50 pb-[calc(5.75rem_+_env(safe-area-inset-bottom))]">
      <Header title="Notices" subtitle={property?.name} avatar={avatar} onBack={onBack} onProfile={onProfile} />
      <main className="mx-auto max-w-md space-y-2.5 px-3 py-2.5">
        {notices.length === 0 ? <div className="rounded-2xl bg-white p-4 text-center text-sm text-slate-500">No notices yet.</div> : notices.map(notice => (
          <article key={notice.id} className={`rounded-2xl border bg-white p-2.5 shadow-sm ${notice.is_urgent ? 'border-red-200 bg-red-50' : 'border-slate-100'}`}>
            <div className="flex min-w-0 items-start justify-between gap-2">
              <h2 className="min-w-0 truncate text-sm font-black text-slate-900">{notice.title}</h2>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{notice.type}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{notice.content}</p>
            <p className="mt-1.5 text-[10px] text-slate-400">{formatDate(notice.created_at)}</p>
          </article>
        ))}
      </main>
    </div>
  )
}
