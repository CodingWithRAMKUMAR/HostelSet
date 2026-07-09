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

export default function TenantMobileRequests({ view = 'complaints', property, avatar = 'U', onBack, onProfile, complaints = [], roommates = [], room, onDeleteComplaint, onRaiseComplaint, isSubmitting, pendingRoomChangeRequest, onRoomChange, existingVacateRequest, vacateBlockedReason, onVacate, onCancelVacate }) {
  const title = view === 'room-change' ? 'Room change' : view === 'vacate' ? 'Vacate' : view === 'roommates' ? 'Roommates' : 'Complaints'
  return (
    <div className="min-h-dvh max-w-full overflow-x-hidden bg-slate-50 pb-[calc(5.75rem_+_env(safe-area-inset-bottom))]">
      <Header title={title} subtitle={property?.name} avatar={avatar} onBack={onBack} onProfile={onProfile} />
      <main className="mx-auto max-w-md space-y-2.5 px-3 py-2.5">
        {view === 'complaints' && (
          <>
            <button type="button" onClick={onRaiseComplaint} className="w-full rounded-2xl bg-orange-500 px-3 py-2 text-sm font-black text-white shadow-sm">Raise complaint</button>
            {complaints.length === 0 ? <div className="rounded-2xl bg-white p-4 text-center text-sm text-slate-500">No complaints filed yet.</div> : complaints.map(complaint => (
              <article key={complaint.id} className="rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0"><h2 className="truncate text-sm font-black text-slate-900">{complaint.title}</h2><p className="line-clamp-2 text-xs leading-5 text-slate-600">{complaint.description}</p></div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{complaint.status}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2"><p className="text-[10px] text-slate-400">{formatDate(complaint.created_at)}</p><button disabled={isSubmitting} onClick={() => onDeleteComplaint(complaint.id)} className="text-[11px] font-bold text-red-600 disabled:opacity-50">Delete</button></div>
              </article>
            ))}
          </>
        )}
        {view === 'room-change' && (
          <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">{pendingRoomChangeRequest ? 'Request pending' : 'Request a new room'}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">{pendingRoomChangeRequest ? 'Your room-change request is awaiting owner approval.' : 'Choose an available room and send a request to your owner.'}</p>
            <button type="button" onClick={onRoomChange} disabled={isSubmitting || Boolean(pendingRoomChangeRequest)} className="mt-3 w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{pendingRoomChangeRequest ? 'Pending' : 'Choose room'}</button>
          </section>
        )}
        {view === 'vacate' && (
          <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">{existingVacateRequest ? 'Vacate request' : 'Request vacate'}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">{existingVacateRequest ? `Your request is ${existingVacateRequest.status}.` : (vacateBlockedReason || 'Submit a planned checkout request to your owner.')}</p>
            {existingVacateRequest ? <button type="button" onClick={onCancelVacate} disabled={isSubmitting} className="mt-3 w-full rounded-xl border border-amber-300 px-3 py-2 text-sm font-bold text-amber-700 disabled:opacity-50">Cancel request</button> : <button type="button" onClick={onVacate} disabled={isSubmitting || Boolean(vacateBlockedReason)} className="mt-3 w-full rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Request vacate</button>}
          </section>
        )}
        {view === 'roommates' && (
          <>
            {roommates.length === 0 ? <div className="rounded-2xl bg-white p-4 text-center text-sm text-slate-500">No roommates currently in Room {room?.room_number || '—'}.</div> : roommates.map(mate => (
              <article key={mate.id} className="rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">{mate.name?.charAt(0) || '?'}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-900">{mate.name || 'Roommate'}</p><p className="truncate text-[11px] text-slate-500">Joined {formatDate(mate.move_in_date)}</p></div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{mate.status || 'active'}</span>
                </div>
              </article>
            ))}
          </>
        )}
      </main>
    </div>
  )
}
