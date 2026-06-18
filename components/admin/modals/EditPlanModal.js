export default function EditPlanModal({ plan, onSave, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-800" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">Edit {plan.name}</h2>
        <div><label>Price (₹)</label><input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2" value={plan.price} onChange={e => onSave({...plan, price: parseInt(e.target.value)})} /></div>
        <div><label>Features (comma separated)</label><input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2" value={plan.features?.join(', ')} onChange={e => onSave({...plan, features: e.target.value.split(',').map(f=>f.trim())})} /></div>
        <div className="flex gap-3 mt-4"><button onClick={() => onSave(plan)} className="bg-purple-700 text-white px-4 py-2 rounded-lg">Save</button><button onClick={onCancel} className="border border-gray-700 px-4 py-2 rounded-lg">Cancel</button></div>
      </div>
    </div>
  )
}
