import { useMemo, useState } from 'react'
import NotificationBell from '../../common/NotificationBell'
import DashboardIcon from '../../dashboard/DashboardIcon'
import { formatCurrency, getSharingDetails } from '../../../lib/utils'

function Header({ onBack, onAddRoom }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 px-3 pt-[calc(env(safe-area-inset-top)_+_0.25rem)] pb-1 text-white">
      <div className="flex min-h-[42px] items-center gap-2">
        <button type="button" onClick={onBack} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base" aria-label="Back">←</button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-black leading-tight">Rooms</p>
          <p className="truncate text-[10px] font-medium leading-tight text-slate-400">Manage beds and occupancy</p>
        </div>
        <NotificationBell listenForGlobalOpen />
        <button type="button" onClick={onAddRoom} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-lg font-black" aria-label="Add room">+</button>
      </div>
    </header>
  )
}

export default function OwnerMobileRooms({ rooms = [], tenants = [], onBack, onRoomClick, onDeleteRoom, onAddRoom, isSubmitting }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const filteredRooms = useMemo(() => rooms.filter(room => {
    const text = `${room.room_number || ''} ${room.room_audience || ''} ${room.sharing_type || ''}`.toLowerCase()
    const occupancy = Number(room.current_occupants || 0)
    const capacity = Number(room.capacity || 0)
    if (query && !text.includes(query.toLowerCase())) return false
    if (filter === 'vacant') return occupancy < capacity
    if (filter === 'full') return capacity > 0 && occupancy >= capacity
    return true
  }), [rooms, query, filter])

  return (
    <div className="max-w-full overflow-x-hidden bg-slate-950 pb-[calc(5.1rem_+_env(safe-area-inset-bottom))]">
      <Header onBack={onBack} onAddRoom={onAddRoom} />
      <main className="mx-auto max-w-md space-y-2 px-3 py-2">
        <label className="flex h-9 items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-3 text-slate-300">
          <DashboardIcon name="search" className="h-4 w-4 shrink-0" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search rooms" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
        </label>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {['all', 'vacant', 'full'].map(item => <button key={item} type="button" onClick={() => setFilter(item)} className={`h-7 shrink-0 rounded-full px-3 text-[11px] font-black capitalize ${filter === item ? 'bg-orange-500 text-white' : 'bg-white/8 text-slate-300'}`}>{item}</button>)}
        </div>
        {filteredRooms.length === 0 ? <div className="rounded-2xl bg-white/8 p-4 text-center text-sm text-slate-400">No matching rooms.</div> : filteredRooms.map(room => {
          const sharing = getSharingDetails(room.sharing_type)
          const occupants = Number(room.current_occupants || tenants.filter(t => t.room_id === room.id).length || 0)
          const capacity = Number(room.capacity || 0)
          return (
            <button key={room.id} type="button" onClick={() => onRoomClick(room)} className="flex min-h-[78px] w-full min-w-0 items-center gap-2 rounded-3xl border border-white/10 bg-white p-2.5 text-left shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><DashboardIcon name="rooms" className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black leading-tight text-slate-900">Room {room.room_number}</span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">{sharing?.label || 'Room'} · {room.room_audience || 'Co-living'}</span>
                <span className="mt-1 block truncate text-xs font-black text-slate-900">{formatCurrency(room.monthly_rent || 0)} <span className="font-semibold text-slate-400">/month</span></span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-2">
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-700">{occupants}/{capacity}</span>
                <span onClick={(event) => { event.stopPropagation(); if (!isSubmitting && occupants <= 0 && confirm(`Delete Room ${room.room_number}?`)) onDeleteRoom(room.id) }} className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-lg font-black leading-none text-slate-500">⋮</span>
              </span>
            </button>
          )
        })}
      </main>
    </div>
  )
}
