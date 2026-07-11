import { useState } from 'react'
import { formatDate } from '../../../lib/utils'
import { useModalAccessibility } from '../../../hooks/useModalAccessibility'
import { useUnsavedChangesGuard } from '../../../hooks/useUnsavedChangesGuard'
import { BLOOD_GROUPS, displayBloodGroup } from '../../../lib/bloodGroups'
import DashboardIcon from '../../dashboard/DashboardIcon'

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2">
      <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-500">
        <DashboardIcon name={icon} className="h-4 w-4 shrink-0 text-slate-400" />
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-sm font-bold text-slate-900">{value || 'Not provided'}</span>
    </div>
  )
}

function TenantProfilePhoto({ src, name }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return <img src={src} alt={name ? `${name} profile photo` : 'Tenant profile photo'} onError={() => setFailed(true)} className="h-11 w-11 shrink-0 rounded-full object-cover" />
  }
  return <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-slate-700 to-slate-500 text-base font-bold text-white">{name?.charAt(0) || 'U'}</div>
}

export default function ProfileModal({
  tenant = {},
  room = {},
  profilePhotoUrl,
  rentStatus = {},
  profileForm = {},
  setProfileForm = () => {},
  editProfile = false,
  setEditProfile = () => {},
  isSubmitting = false,
  onUpdate = () => {},
  onCancel = () => {},
}) {
  const isDirty = editProfile && (
    (profileForm.name || '') !== (tenant?.name || '') ||
    (profileForm.phone || '') !== (tenant?.phone || '') ||
    (profileForm.blood_group || '') !== (tenant?.blood_group || '')
  )
  const confirmDiscard = useUnsavedChangesGuard(isDirty && !isSubmitting)
  const requestCancel = () => { if (!isSubmitting && confirmDiscard()) onCancel() }
  const requestStopEditing = () => { if (!isSubmitting && confirmDiscard()) setEditProfile(false) }
  const dialogRef = useModalAccessibility(requestCancel, isSubmitting)
  const inputClass = 'h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 pt-[calc(env(safe-area-inset-top)_+_0.5rem)] sm:items-center sm:p-4" onClick={requestCancel}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="profile-modal-title" className="flex max-h-[86dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 p-3">
          <h2 id="profile-modal-title" className="flex items-center gap-2 text-base font-black text-slate-900">
            <DashboardIcon name="users" className="h-4 w-4 text-orange-500" />
            My profile
          </h2>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => editProfile ? requestStopEditing() : setEditProfile(true)} disabled={isSubmitting} className="h-8 rounded-xl px-3 text-xs font-bold text-orange-600 hover:bg-orange-50 disabled:opacity-50">{editProfile ? 'Cancel edit' : 'Edit'}</button>
            <button type="button" onClick={requestCancel} disabled={isSubmitting} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close profile">&times;</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {!editProfile ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <TenantProfilePhoto src={profilePhotoUrl} name={tenant?.name} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">{tenant?.name}</p>
                  <p className="text-xs text-slate-500">Tenant</p>
                </div>
              </div>
              <div>
                <InfoRow icon="phone" label="Phone" value={tenant?.phone} />
                <InfoRow icon="mail" label="Email" value={tenant?.email} />
                <InfoRow icon="users" label="Blood group" value={displayBloodGroup(tenant?.blood_group)} />
                <InfoRow icon="rooms" label="Room" value={room?.room_number} />
                <InfoRow icon="calendar" label="Next due" value={rentStatus?.dueDate ? formatDate(rentStatus.dueDate) : rentStatus?.message} />
                <InfoRow icon="calendar" label="Joined" value={formatDate(tenant?.move_in_date)} />
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div>
                <label htmlFor="tenant-profile-name" className="mb-1 block text-xs font-bold text-slate-700">Full name</label>
                <input id="tenant-profile-name" name="name" type="text" className={inputClass} value={profileForm.name || ''} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} />
              </div>
              <div>
                <label htmlFor="tenant-profile-phone" className="mb-1 block text-xs font-bold text-slate-700">Phone number</label>
                <input id="tenant-profile-phone" name="phone" type="tel" className={inputClass} value={profileForm.phone || ''} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} />
              </div>
              <div>
                <label htmlFor="tenant-profile-email" className="mb-1 block text-xs font-bold text-slate-700">Email</label>
                <input id="tenant-profile-email" name="email" type="email" className={`${inputClass} bg-slate-100 text-slate-500`} value={profileForm.email || ''} readOnly />
              </div>
              <div>
                <label htmlFor="tenant-profile-blood-group" className="mb-1 block text-xs font-bold text-slate-700">Blood group *</label>
                <select id="tenant-profile-blood-group" name="blood_group" required className={`${inputClass} bg-white`} value={profileForm.blood_group || ''} onChange={e => setProfileForm({ ...profileForm, blood_group: e.target.value })}>
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}
                </select>
              </div>
              <p className="text-xs text-slate-500">Email, room, rent and payment fields are protected. Contact support to change your login email.</p>
            </div>
          )}
        </div>
        {editProfile ? (
          <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]">
            <button type="button" onClick={onUpdate} disabled={isSubmitting} className="h-9 flex-1 rounded-xl bg-slate-800 text-sm font-semibold text-white disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Save changes'}</button>
            <button type="button" onClick={requestStopEditing} disabled={isSubmitting} className="h-9 flex-1 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
