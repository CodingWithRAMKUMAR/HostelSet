import { memo, useState } from 'react'
import RoommateContactDialog from './RoommateContactDialog'

const RoommatesSection = ({ roommates = [], room = null }) => {
  const [selected, setSelected] = useState(null)
  if (roommates.length === 0) return <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm"><p className="font-semibold text-slate-800">You&apos;re currently the only tenant in this room</p><p className="mt-1 text-sm text-gray-500">New roommates will appear here automatically.</p></div>
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-800">Your Roommates</h3><p className="mb-5 text-sm text-gray-500">Room {room?.room_number || '—'} · {roommates.length} roommate{roommates.length === 1 ? '' : 's'}</p>
      <div className="grid gap-4 lg:grid-cols-2">{roommates.map(mate => <button key={mate.id} type="button" onClick={() => setSelected(mate)} className="flex min-w-0 items-center gap-3 rounded-2xl border border-gray-200 p-4 text-left transition hover:border-orange-300 focus-visible:ring-2 focus-visible:ring-orange-500"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-700 font-bold text-white">{mate.name?.charAt(0) || '?'}</span><span className="min-w-0"><span className="block truncate font-bold text-slate-800">{mate.name || 'Roommate'}</span><span className="block text-sm text-slate-500">View contact details</span></span></button>)}</div>
      <RoommateContactDialog roommate={selected} onClose={() => setSelected(null)} />
    </section>
  )
}
export default memo(RoommatesSection)
