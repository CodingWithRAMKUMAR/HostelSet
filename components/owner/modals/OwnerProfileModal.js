import { useState } from 'react';

export default function OwnerProfileModal({ profile, onSave, onCancel, isSubmitting }) {
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="owner-profile-title">
      <form
        className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => { event.preventDefault(); onSave(form); }}
      >
        <h2 id="owner-profile-title" className="text-2xl font-bold">👤 Edit Owner Profile</h2>
        <div>
          <label htmlFor="ownerName" className="block text-sm font-semibold text-gray-700 mb-2">Full name</label>
          <input id="ownerName" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl" required />
        </div>
        <div>
          <label htmlFor="ownerPhone" className="block text-sm font-semibold text-gray-700 mb-2">Phone number</label>
          <input id="ownerPhone" type="tel" inputMode="numeric" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl" required />
        </div>
        <div>
          <label htmlFor="ownerEmail" className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
          <input id="ownerEmail" type="email" value={profile?.email || ''} className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500" readOnly />
          <p className="text-xs text-gray-400 mt-1">Email changes require a verified authentication flow.</p>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={isSubmitting} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50">{isSubmitting ? 'Saving…' : 'Save Profile'}</button>
          <button type="button" onClick={onCancel} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">Cancel</button>
        </div>
      </form>
    </div>
  );
}
