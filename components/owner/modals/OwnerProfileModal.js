import { useState } from 'react'
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock'
import DashboardIcon from '../../dashboard/DashboardIcon'

export default function OwnerProfileModal({ profile, onSave, onCancel, isSubmitting }) {
  useBodyScrollLock(true)
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 pt-[calc(env(safe-area-inset-top)_+_0.5rem)] sm:items-center sm:p-4" onClick={onCancel} role="presentation">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-profile-title"
        className="flex max-h-[86dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => { event.preventDefault(); onSave(form) }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 p-3">
          <h2 id="owner-profile-title" className="flex items-center gap-2 text-base font-black leading-tight text-slate-900">
            <DashboardIcon name="users" className="h-4 w-4 text-orange-500" />
            Edit owner profile
          </h2>
          <button type="button" onClick={onCancel} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Close owner profile">&times;</button>
        </div>
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
          <div>
            <label htmlFor="ownerName" className="mb-1 block text-xs font-bold text-gray-700">Full name</label>
            <input id="ownerName" name="full_name" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} className="h-9 w-full rounded-xl border border-gray-200 px-3 text-sm" required />
          </div>
          <div>
            <label htmlFor="ownerPhone" className="mb-1 block text-xs font-bold text-gray-700">Phone number</label>
            <input id="ownerPhone" name="phone" type="tel" inputMode="numeric" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="h-9 w-full rounded-xl border border-gray-200 px-3 text-sm" required />
          </div>
          <div>
            <label htmlFor="ownerEmail" className="mb-1 block text-xs font-bold text-gray-700">Email</label>
            <input id="ownerEmail" name="email" type="email" value={profile?.email || ''} className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500" readOnly />
            <p className="mt-1 text-xs text-gray-400">Email changes require a verified authentication flow.</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]">
          <button type="submit" disabled={isSubmitting} className="h-9 flex-1 rounded-xl bg-slate-800 text-sm font-semibold text-white disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Save profile'}</button>
          <button type="button" onClick={onCancel} className="h-9 flex-1 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700">Cancel</button>
        </div>
      </form>
    </div>
  )
}
