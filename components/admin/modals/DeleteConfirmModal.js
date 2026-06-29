export default function DeleteConfirmModal({ type, name, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-800">
        <h2 className="text-2xl font-bold mb-4 text-red-400">Confirm Deletion</h2>
        <p>Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.</p>
        <div className="flex gap-3 mt-6">
          <button onClick={onConfirm} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg">Delete</button>
          <button onClick={onCancel} className="border border-gray-700 px-4 py-2 rounded-lg">Cancel</button>
        </div>
      </div>
    </div>
  )
}
