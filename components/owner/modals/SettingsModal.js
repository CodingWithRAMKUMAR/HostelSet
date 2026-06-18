export default function SettingsModal({ settings, setSettings, onSave, onCancel, isSubmitting }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">⚙️ Property Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Joining Fee (₹)</label>
            <input
              type="number"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl"
              value={settings.joining_fee}
              onChange={(e) => setSettings({...settings, joining_fee: parseInt(e.target.value || 0, 10) || 0})}
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Advance Months Required (default for new tenants)</label>
            <input
              type="number"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl"
              value={settings.advance_months}
              onChange={(e) => setSettings({...settings, advance_months: parseInt(e.target.value || 0, 10) || 0})}
              min="0"
              max="12"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Alert Threshold (days before due)</label>
            <input
              type="number"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl"
              value={settings.due_day}
              onChange={(e) => setSettings({...settings, due_day: parseInt(e.target.value || 5, 10) || 5})}
              min="1"
              max="30"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Your UPI ID (for rent payments)</label>
            <input
              type="text"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl"
              placeholder="yourname@okhdfcbank"
              value={settings.upi_id}
              onChange={(e) => setSettings({...settings, upi_id: e.target.value})}
            />
            <p className="text-xs text-gray-400 mt-1">Tenants can pay to this UPI ID.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">UPI Phone Number (optional)</label>
            <input
              type="tel"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl"
              placeholder="9876543210"
              value={settings.upi_phone}
              onChange={(e) => setSettings({...settings, upi_phone: e.target.value})}
            />
            <p className="text-xs text-gray-400 mt-1">If provided, tenants can also pay using this phone number as UPI ID.</p>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onSave} disabled={isSubmitting} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
              {isSubmitting ? 'Saving...' : 'Save Settings'}
            </button>
            <button onClick={onCancel} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
