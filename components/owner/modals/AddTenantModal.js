import { formatCurrency, getSharingDetails } from '../../../lib/utils'
import { BLOOD_GROUPS } from '../../../lib/bloodGroups'
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock'
import { useEffect, useState } from 'react'

export default function AddTenantModal({ formData, setFormData, rooms = [], onAdd, onCancel, isSubmitting }) {
  useBodyScrollLock(true)
  const availableRooms = rooms.filter(r => r.current_occupants < r.capacity)
  const inputClass = 'h-9 w-full rounded-xl border border-gray-200 px-3 text-sm'
  const [preview, setPreview] = useState('')
  const [photoError, setPhotoError] = useState('')

  useEffect(() => {
    if (!formData.profile_photo_file) { setPreview(''); return undefined }
    const url = URL.createObjectURL(formData.profile_photo_file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [formData.profile_photo_file])

  const choosePhoto = event => {
    const file = event.target.files?.[0] || null
    setPhotoError('')
    if (!file) { setFormData({ ...formData, profile_photo_file:null }); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Use a JPEG, PNG, or WEBP image.')
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Profile photo must be under 5MB.')
      event.target.value = ''
      return
    }
    setFormData({ ...formData, profile_photo_file:file })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 pt-[calc(env(safe-area-inset-top)_+_0.5rem)] sm:items-center sm:p-4" onClick={onCancel}>
      <div className="flex max-h-[86dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 border-b border-slate-200 p-3">
          <h2 className="text-base font-black leading-tight text-slate-900">Add New Tenant</h2>
        </div>
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
          <input type="text" placeholder="Full Name *" className={inputClass} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
          <input type="tel" placeholder="Phone Number *" className={inputClass} value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} maxLength={10} />
          <input type="email" placeholder="Email Address * (required for login)" className={inputClass} value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
          <div className="rounded-xl border border-slate-200 p-2">
            <label htmlFor="owner-add-tenant-photo" className="block text-xs font-bold text-slate-700">Profile photo</label>
            <p className="mb-2 text-[11px] text-slate-500">JPEG, PNG, or WEBP under 5MB. This is not ID proof.</p>
            <div className="flex items-center gap-3">
              {preview ? <img src={preview} alt="Selected tenant profile preview" className="h-14 w-14 rounded-full object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-white">{formData.name?.charAt(0) || '?'}</span>}
              <input id="owner-add-tenant-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} className="min-w-0 flex-1 text-xs" />
            </div>
            {photoError && <p className="mt-1 text-xs font-semibold text-red-600" role="alert">{photoError}</p>}
          </div>
          <label className="block text-xs font-bold text-slate-700">Blood group *
            <select required className={`${inputClass} mt-1 bg-white`} value={formData.blood_group} onChange={(e) => setFormData({...formData, blood_group: e.target.value})}>
              <option value="">Select blood group</option>
              {BLOOD_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}
            </select>
          </label>
          <input type="number" placeholder="Monthly Rent (₹) *" className={inputClass} value={formData.rent_amount} onChange={(e) => setFormData({...formData, rent_amount: e.target.value})} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-gray-500">Advance Months</label>
              <input type="number" placeholder="0" className={inputClass} value={formData.advance_amount} onChange={(e) => setFormData({...formData, advance_amount: e.target.value})} min="0" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-gray-500">Joining Fee (₹)</label>
              <input type="number" placeholder="0" className={inputClass} value={formData.joining_fee} onChange={(e) => setFormData({...formData, joining_fee: e.target.value})} min="0" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">Select Room</label>
            {availableRooms.length === 0 ? (
              <p className="rounded-xl bg-red-50 p-2 text-xs font-semibold text-red-600">No rooms available. Please add a room first.</p>
            ) : (
              <select className={`${inputClass} bg-white`} value={formData.room_id} onChange={(e) => setFormData({...formData, room_id: e.target.value})}>
                <option value="">Select a room</option>
                {availableRooms.map(room => <option key={room.id} value={room.id}>Room {room.room_number} - {getSharingDetails(room.sharing_type)?.label} - {formatCurrency(room.monthly_rent)}/month ({room.capacity - room.current_occupants} slots)</option>)}
              </select>
            )}
          </div>
          <div className="rounded-xl bg-blue-50 p-2 text-xs text-blue-700">After adding, tenant receives a password set email and can log in with their email.</div>
        </div>
        <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]">
          <button type="button" onClick={onAdd} disabled={isSubmitting || availableRooms.length === 0} className="h-9 flex-1 rounded-xl bg-slate-800 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? 'Adding...' : 'Add Tenant'}</button>
          <button type="button" onClick={onCancel} className="h-9 flex-1 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700">Cancel</button>
        </div>
      </div>
    </div>
  )
}
