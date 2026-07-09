import NotificationBell from '../../common/NotificationBell'
import { formatCurrency, getSharingDetails } from '../../../lib/utils'

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

export default function OwnerMobileRooms({ rooms = [], tenants = [], property, avatar = 'O', onBack, onProfile, onRoomClick, onDeleteRoom, onAddRoom, isSubmitting }) {
  return (
    <div className="min-h-dvh max-w-full overflow-x-hidden bg-slate-50 pb-[calc(5.75rem_+_env(safe-area-inset-bottom))]">
      <Header title="Rooms" subtitle={property?.name} avatar={avatar} onBack={onBack} onProfile={onProfile} />
      <main className="mx-auto max-w-md space-y-2.5 px-3 py-2.5">
        <button type="button" onClick={onAddRoom} disabled={isSubmitting} className="w-full rounded-2xl bg-orange-500 px-3 py-2 text-sm font-black text-white shadow-sm disabled:opacity-50">+ Add Room</button>
        {rooms.length === 0 ? <div className="rounded-2xl bg-white p-4 text-center text-sm text-slate-500">No rooms added yet.</div> : rooms.map(room => {
          const sharing = getSharingDetails(room.sharing_type)
          const occupants = tenants.filter(t => t.room_id === room.id)
          const pct = Math.min(100, (Number(room.current_occupants || 0) / Math.max(1, Number(room.capacity || 1))) * 100)
          return (
            <button key={room.id} type="button" onClick={() => onRoomClick(room)} className="block w-full min-w-0 rounded-2xl border border-slate-100 bg-white p-2.5 text-left shadow-sm">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black leading-tight text-slate-900">Room {room.room_number}</p>
                  <p className="truncate text-[11px] leading-tight text-slate-500">{sharing?.label || 'Room'} · {room.room_audience || 'co-living'}</p>
                </div>
                <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">{room.current_occupants || 0}/{room.capacity || 0}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">{formatCurrency(room.monthly_rent || 0)}</p>
                <p className="truncate text-[11px] text-slate-500">{occupants.length ? occupants.slice(0, 2).map(t => t.name).join(', ') : 'No residents'}</p>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} /></div>
              <div className="mt-1.5 flex justify-end">
                <span onClick={(e) => { e.stopPropagation(); if (!isSubmitting && room.current_occupants <= 0 && confirm(`Delete Room ${room.room_number}?`)) onDeleteRoom(room.id) }} className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${room.current_occupants > 0 ? 'bg-slate-100 text-slate-400' : 'bg-red-50 text-red-600'}`}>{room.current_occupants > 0 ? 'Locked' : 'Delete'}</span>
              </div>
            </button>
          )
        })}
      </main>
    </div>
  )
}
