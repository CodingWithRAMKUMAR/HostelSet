import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import BrandLogo from '../../components/BrandLogo'
import { supabase } from '../../lib/supabase'
import { BLOOD_GROUPS } from '../../lib/bloodGroups'

const initial = { fullName: '', phone: '', email: '', bloodGroup: '', roomId: '', currentRent: '', moveInDate: '', paidThroughDate: '', emergencyContact: '', occupation: '', notes: '' }

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function isRentAnchorDate(moveInDate, paidThroughDate) {
  if (!isValidDateString(moveInDate) || !isValidDateString(paidThroughDate)) return false
  const [startYear, startMonth, startDay] = moveInDate.split('-').map(Number)
  const [targetYear, targetMonth, targetDay] = paidThroughDate.split('-').map(Number)
  let offset = 0
  while (offset < 600) {
    const index = startYear * 12 + startMonth - 1 + offset
    const year = Math.floor(index / 12)
    const monthIndex = index % 12
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
    const dueDay = Math.min(startDay, lastDay)
    if (year === targetYear && monthIndex + 1 === targetMonth && dueDay === targetDay) return true
    if (year > targetYear || (year === targetYear && monthIndex + 1 > targetMonth)) return false
    offset += 1
  }
  return false
}

function validatePaidThrough(moveInDate, paidThroughDate) {
  if (!paidThroughDate) return 'Please select the last paid rent due date.'
  if (!isValidDateString(paidThroughDate)) return 'Please select a valid last paid rent due date.'
  if (!isValidDateString(moveInDate)) return 'Please select a valid hostel joined date first.'
  if (paidThroughDate < moveInDate) return 'Last paid rent due date cannot be before the hostel joined date.'
  if (paidThroughDate > todayIsoDate()) return 'Last paid rent due date cannot be in the future.'
  if (!isRentAnchorDate(moveInDate, paidThroughDate)) return 'Last paid rent due date must match the tenant rent due-day cycle.'
  return ''
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
    const paidThroughError = validatePaidThrough(form.moveInDate, form.paidThroughDate)
    if (paidThroughError) { setError(paidThroughError); return }
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
        paid_through_date: form.paidThroughDate,
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
            {[['fullName','Full name','text'],['phone','Phone','tel'],['email','Email','email'],['currentRent','Current rent amount','number'],['moveInDate','Hostel joined date','date'],['emergencyContact','Emergency contact','tel']].map(([name,label,type]) => <label key={name} className="text-sm font-medium text-slate-700">{label}<input required name={name} type={type} min={type === 'number' ? 1 : undefined} value={form[name]} onChange={change} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>)}
            <label className="text-sm font-medium text-slate-700">Last paid rent due date
              <input required name="paidThroughDate" type="date" min={form.moveInDate || undefined} max={todayIsoDate()} value={form.paidThroughDate} onChange={change} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
              <span className="mt-1 block text-xs text-slate-500">
                Select the due date of the latest monthly rent you have already paid.
                <br />
                <br />
                Example:
                <br />
                <br />
                If your rent is due on the 12th every month and you have already paid the July rent, select 12 Jul 2026.
                <br />
                <br />
                Your next rent will then become due on 12 Aug 2026.
              </span>
            </label>
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
