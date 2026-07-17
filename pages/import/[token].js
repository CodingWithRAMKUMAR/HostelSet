import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import BrandLogo from '../../components/BrandLogo'
import { supabase } from '../../lib/supabase'
import { BLOOD_GROUPS } from '../../lib/bloodGroups'
import { businessTodayIsoDate, currentRentDueDateFromMoveIn, nextRentDueDateFromMoveIn, previousRentDueDateFromMoveIn } from '../../lib/rentDue'

const initial = { fullName: '', phone: '', email: '', bloodGroup: '', roomId: '', currentRent: '', moveInDate: '', currentCyclePaid: '', emergencyContact: '', occupation: '', notes: '' }

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

function formatImportDate(value) {
  if (!value) return ''
  const [year, month, day] = String(value).split('-').map(Number)
  if (!year || !month || !day) return value
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function jsonRequest(url, options) {
  const response = await fetch(url, options)
  const type = response.headers.get('content-type') || ''
  const data = type.includes('application/json') ? await response.json() : { error: 'The server returned an unexpected response.' }
  if (!response.ok) throw new Error(data.error || 'Request failed')
  return data
}

async function uploadFile(token, category, file) {
  if (!file) throw new Error(category === 'identity' ? 'Please upload ID proof.' : 'Please upload profile photo.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Each file must be under 5MB')
  const prepared = await jsonRequest('/api/import/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, category, contentType: file.type, size: file.size }) })
  const { error } = await supabase.storage.from('tenant-documents').uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type })
  if (error) throw new Error('Document upload failed. Please try again.')
  return prepared.path
}

export default function ExistingTenantImportPage() {
  const router = useRouter()
  const token = String(router.query.token || '')
  const [details, setDetails] = useState(null)
  const [form, setForm] = useState(initial)
  const [idProof, setIdProof] = useState(null)
  const [profilePhoto, setProfilePhoto] = useState(null)
  const [profilePhotoPreview, setProfilePhotoPreview] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const currentDueDate = useMemo(() => isValidDateString(form.moveInDate) ? currentRentDueDateFromMoveIn(form.moveInDate) : '', [form.moveInDate])
  const derivedPaidThroughDate = useMemo(() => {
    if (!currentDueDate) return ''
    if (form.currentCyclePaid === 'yes') return currentDueDate
    if (form.currentCyclePaid === 'no') return previousRentDueDateFromMoveIn(form.moveInDate, currentDueDate)
    return ''
  }, [currentDueDate, form.currentCyclePaid, form.moveInDate])
  const nextDueDate = useMemo(() => currentDueDate ? nextRentDueDateFromMoveIn(form.moveInDate, currentDueDate) : '', [currentDueDate, form.moveInDate])

  useEffect(() => {
    if (!router.isReady) return
    let active = true
    jsonRequest(`/api/import/${encodeURIComponent(token)}`).then(data => { if (active) setDetails(data) }).catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [router.isReady, token])

  useEffect(() => () => { if (profilePhotoPreview) URL.revokeObjectURL(profilePhotoPreview) }, [profilePhotoPreview])

  const change = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  const chooseProfilePhoto = event => {
    const file = event.target.files?.[0] || null
    setProfilePhoto(file)
    if (profilePhotoPreview) URL.revokeObjectURL(profilePhotoPreview)
    setProfilePhotoPreview(file ? URL.createObjectURL(file) : '')
  }
  const submit = async event => {
    event.preventDefault()
    if (submitting) return
    if (!form.bloodGroup) { setError('Please select a blood group.'); return }
    if (!isValidDateString(form.moveInDate) || form.moveInDate > businessTodayIsoDate()) { setError('Please select a valid hostel joined date.'); return }
    if (!currentDueDate) { setError('Unable to calculate the current rent due date. Please check the hostel joined date.'); return }
    if (!['yes', 'no'].includes(form.currentCyclePaid)) { setError(`Please answer whether the rent due on ${formatImportDate(currentDueDate)} has been paid.`); return }
    setSubmitting(true); setError(''); setProgress('Validating details…')
    try {
      setProgress('Uploading documents…')
      const [idProofPath, profilePhotoPath] = await Promise.all([uploadFile(token, 'identity', idProof), uploadFile(token, 'photos', profilePhoto)])
      setProgress('Submitting for owner review…')
      const payload = {
        token,
        full_name: form.fullName,
        phone: form.phone,
        email: form.email,
        blood_group: form.bloodGroup,
        room_id: form.roomId,
        current_rent_amount: form.currentRent,
        move_in_date: form.moveInDate,
        current_rent_due_date: currentDueDate,
        current_rent_cycle_paid: form.currentCyclePaid === 'yes',
        paid_through_date: derivedPaidThroughDate,
        emergency_contact: form.emergencyContact,
        occupation: form.occupation,
        notes: form.notes,
        id_proof_path: idProofPath,
        profile_photo_path: profilePhotoPath,
      }
      const result = await jsonRequest('/api/import/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setSuccess(result.message); toast.success('Details submitted successfully')
    } catch (err) { setError(err.message); toast.error(err.message) }
    finally { setSubmitting(false); setProgress('') }
  }

  return <>
    <Head><title>Existing Tenant Import | HostelSet</title><meta name="robots" content="noindex,nofollow" /></Head>
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex justify-center"><BrandLogo size="login" priority /></div>
        {loading ? <div className="rounded-2xl bg-white p-8 text-center shadow-sm">Opening secure import form…</div> : error && !details ? <div className="rounded-2xl border border-red-200 bg-white p-8 text-center text-red-700">{error}</div> : success ? <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-bold text-slate-900">Submission received</h1><p className="mt-3 text-slate-600">{success}</p></div> : details && <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">Existing Tenant Import</h1>
          <p className="mt-2 text-slate-600">Submit your current tenancy details for <strong>{details.property.name}</strong>{details.property.city ? `, ${details.property.city}` : ''}. The owner will review them before activating your tenant account.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[['fullName','Full name','text'],['phone','Phone','tel'],['email','Email','email'],['currentRent','Current rent amount','number'],['moveInDate','Hostel joined date','date'],['emergencyContact','Emergency contact','tel']].map(([name,label,type]) => <label key={name} className="text-sm font-medium text-slate-700">{label}<input required name={name} type={type} min={type === 'number' ? 1 : undefined} max={name === 'moveInDate' ? businessTodayIsoDate() : undefined} value={form[name]} onChange={change} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>)}
            <fieldset className="text-sm font-medium text-slate-700">
              <legend>Has the rent due on {currentDueDate ? formatImportDate(currentDueDate) : 'the current due date'} been paid?</legend>
              <div className="mt-2 grid gap-2">
                <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5">
                  <input required type="radio" name="currentCyclePaid" value="yes" checked={form.currentCyclePaid === 'yes'} onChange={change} />
                  <span>Yes, paid</span>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5">
                  <input required type="radio" name="currentCyclePaid" value="no" checked={form.currentCyclePaid === 'no'} onChange={change} />
                  <span>No, not paid</span>
                </label>
              </div>
              <span className="mt-2 block text-xs text-slate-500">
                HostelSet does not record advance rent during import. {form.currentCyclePaid === 'yes' && nextDueDate ? `Your next rent will become due on ${formatImportDate(nextDueDate)}.` : form.currentCyclePaid === 'no' && derivedPaidThroughDate ? `Your last paid rent due date will be ${formatImportDate(derivedPaidThroughDate)}.` : 'The owner can correct this answer before approving.'}
              </span>
            </fieldset>
            <label className="text-sm font-medium text-slate-700">Room number<select required name="roomId" value={form.roomId} onChange={change} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">Select room</option>{details.rooms.map(room => <option key={room.id} value={room.id}>Room {room.room_number}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Blood group *<select required name="bloodGroup" value={form.bloodGroup} onChange={change} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">Select blood group</option>{BLOOD_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Occupation<select required name="occupation" value={form.occupation} onChange={change} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">Select</option><option value="student">Student</option><option value="employee">Employee</option><option value="other">Other</option></select></label>
            <label className="text-sm font-medium text-slate-700">ID proof (image or PDF)<input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setIdProof(e.target.files?.[0] || null)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" /></label>
            <label className="text-sm font-medium text-slate-700">Profile photo
              <input required type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseProfilePhoto} className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
              {profilePhotoPreview && <img src={profilePhotoPreview} alt="Selected profile photo preview" className="mt-2 h-20 w-20 rounded-full object-cover" />}
              <span className="mt-1 block text-xs text-slate-500">JPEG, PNG, or WEBP under 5MB. This is not ID proof.</span>
            </label>
          </div>
          <label className="mt-4 block text-sm font-medium text-slate-700">Optional notes<textarea name="notes" maxLength={2000} value={form.notes} onChange={change} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={submitting} className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{submitting ? progress || 'Submitting…' : 'Submit for owner review'}</button>
        </form>}
      </div>
    </main>
  </>
}
