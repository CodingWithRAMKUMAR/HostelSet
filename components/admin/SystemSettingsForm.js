export default function SystemSettingsForm({ settings, setSettings, onSave }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-6 shadow-xl">
      <h2 className="text-xl font-bold mb-4">⚙️ Global System Settings</h2>
      <div className="space-y-4">
        <div><label className="block text-sm font-medium mb-1">Pre‑booking Fee (₹)</label><input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white" value={settings.pre_booking_fee} onChange={e => setSettings({...settings, pre_booking_fee: parseInt(e.target.value)})} /></div>
        <div><label className="block text-sm font-medium mb-1">Max Advance Months (for new tenants)</label><input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white" value={settings.max_advance_months} onChange={e => setSettings({...settings, max_advance_months: parseInt(e.target.value)})} /></div>
        <div><label className="block text-sm font-medium mb-1">Due Alert Threshold (days)</label><input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white" value={settings.due_alert_days} onChange={e => setSettings({...settings, due_alert_days: parseInt(e.target.value)})} /></div>
        <button onClick={onSave} className="bg-purple-700 hover:bg-purple-600 text-white px-6 py-2 rounded-lg">Save Settings</button>
      </div>
    </div>
  )
}
