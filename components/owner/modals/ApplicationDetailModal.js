import { formatDate } from '../../../lib/utils'

export default function ApplicationDetailModal({ application, onApprove, onClose, isSubmitting }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">Application Details</h2>
        <div className="space-y-2 text-sm">
          <p><strong>Name:</strong> {application?.name}</p>
          <p><strong>Phone:</strong> {application?.phone}</p>
          <p><strong>Email:</strong> {application?.email || 'N/A'}</p>
          <p><strong>Message:</strong> {application?.message || 'None'}</p>
          <p><strong>Applied:</strong> {formatDate(application?.created_at)}</p>
          {application?.id_proof && (
            <div className="mt-3">
              <p className="font-semibold mb-1">ID Proof:</p>
              <img src={application.id_proof} alt="ID Proof" className="w-full rounded-lg max-h-48 object-cover border" />
            </div>
          )}
          {application?.photo && (
            <div className="mt-3">
              <p className="font-semibold mb-1">Photo:</p>
              <img src={application.photo} alt="Applicant Photo" className="w-full rounded-lg max-h-48 object-cover border" />
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => { onApprove() }} disabled={isSubmitting} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50">
            Approve
          </button>
          <button onClick={onClose} className="flex-1 border-2 border-gray-300 text-gray-700 py-2 rounded-lg font-semibold">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
