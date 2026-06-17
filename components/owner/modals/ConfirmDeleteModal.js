import { motion, AnimatePresence } from 'framer-motion'

export default function ConfirmDeleteModal({ tenant, onDeleteComplete, onDeleteSoft, onCancel, isSubmitting }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4 text-red-600">⚠️ Delete Tenant</h2>
        <p className="text-gray-600 mb-4">Are you sure you want to delete <strong>{tenant?.name}</strong>?</p>
        <div className="bg-yellow-50 p-3 rounded-lg mb-4">
          <p className="text-sm text-yellow-800">This will permanently delete:</p>
          <ul className="text-xs text-yellow-700 mt-2 space-y-1 list-disc list-inside">
            <li>Tenant record from rooms</li>
            <li>Payment history</li>
            <li>Complaints filed</li>
            <li>Vacate requests</li>
            <li>User account (optional)</li>
          </ul>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onDeleteComplete} disabled={isSubmitting} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
            {isSubmitting ? 'Deleting...' : '🗑️ Delete Permanently'}
          </button>
          <button onClick={onDeleteSoft} disabled={isSubmitting} className="flex-1 bg-yellow-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
            Remove from Room Only
          </button>
          <button onClick={onCancel} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
