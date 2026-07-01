import { formatDate } from '../../../lib/utils'

export default function ProfileModal({
  tenant = {},
  room = {},
  profileForm = {},
  setProfileForm = () => {},
  editProfile = false,
  setEditProfile = () => {},
  isSubmitting = false,
  onUpdate = () => {},
  onCancel = () => {},
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold">👤 My Profile</h2><button onClick={() => setEditProfile(!editProfile)} className="text-sm">{editProfile ? 'Cancel' : 'Edit'}</button></div>
        {!editProfile ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"><div className="w-16 h-16 bg-gradient-to-r from-slate-600 to-slate-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">{tenant?.name?.charAt(0) || 'U'}</div><div><p className="font-semibold">{tenant?.name}</p><p className="text-sm text-gray-500">Tenant</p></div></div>
            <div className="space-y-3"><div className="flex justify-between py-2 border-b"><span>📞 Phone:</span><span>{tenant?.phone}</span></div><div className="flex justify-between py-2 border-b"><span>📧 Email:</span><span>{tenant?.email || 'Not provided'}</span></div><div className="flex justify-between py-2 border-b"><span>🏠 Room:</span><span>{room?.room_number}</span></div><div className="flex justify-between py-2 border-b"><span>📅 Joined:</span><span>{formatDate(tenant?.move_in_date)}</span></div></div>
          </div>
        ) : (
          <div className="space-y-4">
            <input type="text" placeholder="Full Name" className="w-full px-4 py-3 border rounded-xl" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
            <input type="tel" placeholder="Phone Number" className="w-full px-4 py-3 border rounded-xl" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} />
            <input type="email" aria-label="Email cannot be changed" className="w-full px-4 py-3 border rounded-xl bg-gray-100 text-gray-500" value={profileForm.email} readOnly />
            <p className="text-xs text-gray-500">Email, room, rent and payment fields are protected. Contact support to change your login email.</p>
            <div className="flex gap-3 mt-6"><button onClick={onUpdate} disabled={isSubmitting} className="flex-1 bg-slate-800 text-white py-3 rounded-xl">{isSubmitting ? 'Saving...' : 'Save Changes'}</button><button onClick={() => setEditProfile(false)} className="flex-1 border-2 border-gray-300 py-3 rounded-xl">Cancel</button></div>
          </div>
        )}
        <button onClick={onCancel} className="w-full mt-4 py-2 text-gray-500">Close</button>
      </div>
    </div>
  )
}
