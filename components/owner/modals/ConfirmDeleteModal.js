import { motion, AnimatePresence } from 'framer-motion'

export default function ConfirmDeleteModal({ tenant, onArchive, onCancel, isSubmitting }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { if (!isSubmitting) onCancel() }}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4 text-red-600">⚠️ Remove Tenant</h2>
        <p className="text-gray-600 mb-4">Remove <strong>{tenant?.name}</strong> from the active tenant list and release their room?</p>
        <div className="bg-yellow-50 p-3 rounded-lg mb-4">
          <p className="text-sm text-yellow-800">The tenant will be archived. The following records are preserved:</p>
          <ul className="text-xs text-yellow-700 mt-2 space-y-1 list-disc list-inside">
            <li>Payment history and rent records</li>
            <li>Complaints and request history</li>
            <li>User and application records</li>
          </ul>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onArchive} disabled={isSubmitting} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
            {isSubmitting ? 'Removing...' : 'Remove Tenant'}
          </button>
          <button onClick={onCancel} disabled={isSubmitting} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold disabled:opacity-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
