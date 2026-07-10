import { formatCurrency } from '../../../lib/utils'
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock'

export default function AddRoomModal({ roomForm, setRoomForm, sharingTypes, onAdd, onCancel, isSubmitting }) {
  useBodyScrollLock(true)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 pt-[calc(env(safe-area-inset-top)_+_0.5rem)] sm:items-center sm:p-4" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby="add-room-title" className="flex max-h-[86dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 border-b border-slate-200 p-3">
          <h2 id="add-room-title" className="text-base font-black leading-tight text-slate-900">Add New Room</h2>
        </div>
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
          <div>
            <label htmlFor="add-room-number" className="mb-1 block text-xs font-bold text-gray-700">Room number *</label>
            <input id="add-room-number" name="room_number" type="text" placeholder="Room Number *" className="h-9 w-full rounded-xl border border-gray-200 px-3 text-sm" value={roomForm.room_number} onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })} />
          </div>
          <div>
            <label htmlFor="add-room-audience" className="mb-1 block text-xs font-bold text-gray-700">Room category *</label>
            <select id="add-room-audience" name="room_audience" className="h-9 w-full rounded-xl border border-gray-200 px-3 text-sm" value={roomForm.room_audience} onChange={(e) => setRoomForm({ ...roomForm, room_audience: e.target.value })}>
              <option value="boys">Boys Room</option>
              <option value="girls">Girls Room</option>
              <option value="coliving">Co-living Room</option>
            </select>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">Application security deposit: <strong>&#8377;3,000</strong> for every room.</div>
          <div>
            <label htmlFor="add-room-sharing" className="mb-1 block text-xs font-bold text-gray-700">Sharing type *</label>
            <select id="add-room-sharing" name="sharing_type" className="h-9 w-full rounded-xl border border-gray-200 px-3 text-sm" value={roomForm.sharing_type} onChange={(e) => { const selected = sharingTypes.find(t => t.value === e.target.value); setRoomForm({ ...roomForm, sharing_type: e.target.value, monthly_rent: selected.price }) }}>
              {sharingTypes.map(type => <option key={type.value} value={type.value}>{type.label} {type.icon} - {formatCurrency(type.price)}/month</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="add-room-rent" className="mb-1 block text-xs font-bold text-gray-700">Monthly rent (&#8377;) *</label>
            <input id="add-room-rent" name="monthly_rent" type="number" placeholder="Monthly Rent" className="h-9 w-full rounded-xl border border-gray-200 px-3 text-sm" value={roomForm.monthly_rent} onChange={(e) => setRoomForm({ ...roomForm, monthly_rent: parseInt(e.target.value || 0, 10) })} />
          </div>
        </div>
        <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]">
          <button type="button" onClick={onAdd} disabled={isSubmitting} className="h-9 flex-1 rounded-xl bg-slate-800 text-sm font-semibold text-white disabled:opacity-50">Add Room</button>
          <button type="button" onClick={onCancel} className="h-9 flex-1 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700">Cancel</button>
        </div>
      </div>
    </div>
  )
}
