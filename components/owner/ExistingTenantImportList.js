import { useState } from 'react'
import { displayBloodGroup } from '../../lib/bloodGroups'

function formatImportDate(value) {
  if (!value) return 'Not provided'
  const [year, month, day] = String(value).split('-').map(Number)
  if (!year || !month || !day) return value
  return new Date(year, month - 1, day).toLocaleDateString('en-IN')
}

function rentAnswerLabel(value) {
  if (value === true) return 'Paid'
  if (value === false) return 'Not paid'
  return 'Not answered'
}

export default function ExistingTenantImportList({ imports, loading, total, page, pageSize, processingId, onApprove, onReject, onUpdateRentAnswer = () => {}, onPage, onViewDocument = () => {} }) {
  const [openingKey, setOpeningKey] = useState('')
  const openDocument = async (item, documentType) => {
    const key = `${item.id}:${documentType}`
    if (openingKey) return
    setOpeningKey(key)
    try {
      await onViewDocument(item, documentType)
    } finally {
      setOpeningKey('')
    }
  }
  if (loading) return <div className="rounded-xl bg-white p-8 text-center text-slate-500">Loading import submissions...</div>
  if (!imports.length) return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No existing tenant import submissions yet.</div>
  return <section className="space-y-3">
    {imports.map(item => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div>
          <h3 className="font-semibold text-slate-900">{item.full_name}</h3>
          <p className="text-sm text-slate-600">Room {item.rooms?.room_number || item.room_number} - Rs {Number(item.current_rent).toLocaleString('en-IN')} - {item.phone} - {item.email}</p>
          <p className="mt-1 text-xs text-slate-500">Hostel joined date: {formatImportDate(item.move_in_date)} - Current rent due date: {formatImportDate(item.current_rent_due_date)} - Tenant answer: {rentAnswerLabel(item.current_rent_cycle_paid)} - Last paid rent due date: {formatImportDate(item.paid_through_date)} - {item.occupation} - Blood group: {displayBloodGroup(item.blood_group)} - Emergency: {item.emergency_contact}</p>
        </div>
        <span className="h-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">{item.status.replaceAll('_', ' ')}</span>
      </div>
      {item.status === 'pending_owner_review' && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Correct current cycle answer</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={Boolean(processingId) || item.current_rent_cycle_paid === true} onClick={() => onUpdateRentAnswer(item.id, true)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${item.current_rent_cycle_paid === true ? 'bg-emerald-600 text-white' : 'border border-emerald-200 bg-white text-emerald-700'}`}>Yes, paid</button>
            <button type="button" disabled={Boolean(processingId) || item.current_rent_cycle_paid === false} onClick={() => onUpdateRentAnswer(item.id, false)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${item.current_rent_cycle_paid === false ? 'bg-amber-600 text-white' : 'border border-amber-200 bg-white text-amber-700'}`}>No, not paid</button>
          </div>
        </div>
      )}
      {item.notes && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{item.notes}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {item.profile_photo && <button type="button" disabled={Boolean(openingKey)} onClick={() => openDocument(item, 'photo')} className="rounded-lg border px-3 py-1.5 text-sm text-indigo-700 disabled:opacity-50">{openingKey === `${item.id}:photo` ? 'Opening document...' : 'View photo'}</button>}
        {item.id_proof && <button type="button" disabled={Boolean(openingKey)} onClick={() => openDocument(item, 'id_proof')} className="rounded-lg border px-3 py-1.5 text-sm text-indigo-700 disabled:opacity-50">{openingKey === `${item.id}:id_proof` ? 'Opening document...' : 'View ID proof'}</button>}
      </div>
      {item.status === 'pending_owner_review' && <div className="mt-4 flex gap-2"><button disabled={Boolean(processingId)} onClick={() => onApprove(item.id)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{processingId === item.id ? 'Processing...' : 'Approve'}</button><button disabled={Boolean(processingId)} onClick={() => { const reason = prompt('Optional rejection reason:') ?? undefined; if (reason !== undefined) onReject(item.id, reason) }} className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Reject</button></div>}
      {item.rejection_reason && <p className="mt-3 text-sm text-red-700">Reason: {item.rejection_reason}</p>}
    </article>)}
    <div className="flex items-center justify-between"><button disabled={page === 0} onClick={() => onPage(page - 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Previous</button><span className="text-sm text-slate-500">Page {page + 1} of {Math.max(1, Math.ceil(total / pageSize))}</span><button disabled={(page + 1) * pageSize >= total} onClick={() => onPage(page + 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Next</button></div>
  </section>
}
