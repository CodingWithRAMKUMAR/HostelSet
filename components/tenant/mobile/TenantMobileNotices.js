import MobileTopbar from '../../dashboard/MobileTopbar'
import { formatDate } from '../../../lib/utils'

function Header({ onBack, title, subtitle, avatar, avatarUrl, avatarAlt, onProfile }) {
  return (
    <MobileTopbar title={title} subtitle={subtitle} isHome={false} onBack={onBack} onProfile={onProfile} avatar={avatar} avatarUrl={avatarUrl} avatarAlt={avatarAlt} />
  )
}

export default function TenantMobileNotices({ notices = [], property, avatar = 'U', avatarUrl, avatarAlt, onBack, onProfile }) {
  return (
    <div className="min-h-dvh max-w-full overflow-x-hidden bg-slate-950 pb-[calc(5.1rem_+_env(safe-area-inset-bottom))]">
      <Header title="Notices" subtitle={property?.name} avatar={avatar} avatarUrl={avatarUrl} avatarAlt={avatarAlt} onBack={onBack} onProfile={onProfile} />
      <main className="mx-auto max-w-md space-y-2 px-3 py-2">
        {notices.length === 0 ? <div className="rounded-2xl bg-white p-4 text-center text-sm text-slate-500">No notices yet.</div> : notices.map(notice => (
          <article key={notice.id} className={`rounded-2xl border bg-white p-2.5 shadow-sm ${notice.is_urgent ? 'border-red-200 bg-red-50' : 'border-white/10'}`}>
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
