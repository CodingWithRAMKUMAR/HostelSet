export default function EditOwnerSettingsModal({ settings, onSave, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-800" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">Edit Owner Settings</h2>
        <div><label>UPI ID</label><input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2" value={settings.upi_id || ''} onChange={e => onSave({...settings, upi_id: e.target.value})} /></div>
        <div><label>UPI Phone</label><input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2" value={settings.upi_phone || ''} onChange={e => onSave({...settings, upi_phone: e.target.value})} /></div>
        <div><label>Joining Fee (₹)</label><input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2" value={settings.joining_fee || 0} onChange={e => onSave({...settings, joining_fee: parseInt(e.target.value)})} /></div>
        <div><label>Advance Months</label><input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2" value={settings.advance_months || 1} onChange={e => onSave({...settings, advance_months: parseInt(e.target.value)})} /></div>
        <div className="flex gap-3 mt-4"><button onClick={() => onSave(settings.owner_id, settings)} className="bg-purple-700 text-white px-4 py-2 rounded-lg">Save</button><button onClick={onCancel} className="border border-gray-700 px-4 py-2 rounded-lg">Cancel</button></div>
      </div>
    </div>
  )
}
