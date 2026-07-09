import { useState } from 'react'
import LocationPicker from '../../maps/LocationPicker'

export default function SettingsModal({ settings, setSettings, property, onSave, onCancel, isSubmitting }) {
  const [location, setLocation] = useState(property?.latitude ? {
    latitude: property.latitude,
    longitude: property.longitude,
    formatted_address: property.formatted_address || property.address,
    location_place_id: property.location_place_id || null,
  } : null)

  const setNumber = (key, fallback = 0) => event => {
    const value = event.target.value
    setSettings({ ...settings, [key]: value === '' ? '' : parseInt(value, 10) || fallback })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 pt-[calc(env(safe-area-inset-top)_+_0.5rem)] sm:items-center sm:p-3" onClick={onCancel}>
      <div className="flex max-h-[calc(100dvh_-_1rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[86dvh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 p-3">
          <h2 className="text-base font-black leading-tight text-slate-900">Property settings</h2>
          <button type="button" onClick={onCancel} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Close settings">&times;</button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">Joining fee (&#8377;)</label>
            <input type="number" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" value={settings.joining_fee ?? ''} onChange={setNumber('joining_fee', 0)} min="0" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">Advance months required</label>
            <input type="number" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" value={settings.advance_months ?? ''} onChange={setNumber('advance_months', 0)} min="0" max="12" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">Alert threshold (days before due)</label>
            <input type="number" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" value={settings.due_day ?? ''} onChange={setNumber('due_day', 5)} min="1" max="30" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">Your UPI ID</label>
            <input type="text" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="yourname@okhdfcbank" value={settings.upi_id || ''} onChange={(e) => setSettings({ ...settings, upi_id: e.target.value })} />
            <p className="mt-1 text-xs text-gray-400">Tenants can pay to this UPI ID.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">UPI phone number (optional)</label>
            <input type="tel" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" placeholder="9876543210" value={settings.upi_phone || ''} onChange={(e) => setSettings({ ...settings, upi_phone: e.target.value })} />
            <p className="mt-1 text-xs text-gray-400">Optional phone number-based UPI ID.</p>
          </div>
          <div className="border-t pt-3">
            <h3 className="mb-2 text-sm font-bold text-slate-800">Property map location</h3>
            <LocationPicker value={location} onChange={setLocation} />
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]">
          <button onClick={() => onSave(location)} disabled={isSubmitting || !location?.latitude} className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {isSubmitting ? 'Saving...' : 'Save settings'}
          </button>
          <button onClick={onCancel} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-bold text-gray-700">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
