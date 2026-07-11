import { useState } from 'react'

export default function ConfirmDeleteModal({ tenant, onArchive, onCancel, isSubmitting }) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { if (!isSubmitting) onCancel() }}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-xl font-bold text-red-600">Vacate and archive tenant?</h2>
        <p className="mt-3 text-sm text-gray-600">
          Move <strong>{tenant?.name}</strong> out of active tenants and release their room slot exactly once.
        </p>
        <div className="mt-4 rounded-xl bg-yellow-50 p-3">
          <p className="text-sm font-semibold text-yellow-800">Historical records stay preserved:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-yellow-700">
            <li>Payment history, rent records, and deposit history</li>
            <li>Complaint, vacate, and room-change history</li>
            <li>User, application, and import records</li>
          </ul>
        </div>
        <label htmlFor="archive-tenant-reason" className="mt-4 block text-sm font-semibold text-slate-700">Reason</label>
        <select
          id="archive-tenant-reason"
          name="archive_reason"
          value={reason}
          onChange={event => setReason(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
        >
          <option value="">Select a reason</option>
          <option value="tenant left early">Tenant left early</option>
          <option value="agreement completed">Agreement completed</option>
          <option value="owner-requested vacate">Owner-requested vacate</option>
          <option value="duplicate/test tenant">Duplicate/test tenant</option>
          <option value="misconduct">Misconduct</option>
          <option value="other">Other</option>
        </select>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => onArchive(reason)}
            disabled={isSubmitting || !reason}
            className="flex-1 rounded-xl bg-red-600 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-red-200 disabled:text-red-700"
          >
            {isSubmitting ? 'Archiving...' : 'Vacate and Archive'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-xl border-2 border-gray-300 py-3 font-semibold text-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
