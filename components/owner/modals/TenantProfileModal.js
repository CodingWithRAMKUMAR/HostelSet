import { formatCurrency, formatDate } from '../../../lib/utils'

export default function TenantProfileModal({ tenant, application, loading, onClose, onViewScreenshot }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Tenant Profile</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
        </div>
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              {application?.photo ? (
                <img src={application.photo} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-slate-200" />
              ) : (
                <div className="w-32 h-32 rounded-full bg-slate-200 flex items-center justify-center text-4xl font-bold text-slate-500">
                  {(tenant?.name?.charAt(0) || 'U').toUpperCase()}
                </div>
              )}
            </div>
            <div className="border-t pt-4">
              <h3 className="font-semibold text-lg mb-2">Personal Information</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Name:</strong> {tenant?.name}</p>
                <p><strong>Phone:</strong> {tenant?.phone}</p>
                <p><strong>Email:</strong> {tenant?.email || 'N/A'}</p>
                <p><strong>Move-in Date:</strong> {formatDate(tenant?.move_in_date)}</p>
                <p><strong>Rent Amount:</strong> {formatCurrency(tenant?.rent_amount)}</p>
                <p><strong>Paid:</strong> {formatCurrency(tenant?.total_paid || 0)}</p>
                <p><strong>Pending:</strong> {formatCurrency(tenant?.pending_amount || 0)}</p>
              </div>
            </div>
            {application && (
              <div className="border-t pt-4">
                <h3 className="font-semibold text-lg mb-2">Documents (from Application)</h3>
                <div className="space-y-3">
                  {application.id_proof && (
                    <div>
                      <p className="text-sm font-medium">ID Proof:</p>
                      <button onClick={() => onViewScreenshot(application.id_proof)} className="mt-1">
                        <img src={application.id_proof} alt="ID Proof" className="max-h-40 rounded border cursor-pointer hover:opacity-80" />
                      </button>
                    </div>
                  )}
                  {application.photo && (
                    <div>
                      <p className="text-sm font-medium">Passport Photo:</p>
                      <button onClick={() => onViewScreenshot(application.photo)}>
                        <img src={application.photo} alt="Photo" className="max-h-40 rounded border cursor-pointer hover:opacity-80" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {!application && (
              <div className="border-t pt-4 text-center text-gray-500">No application documents found. This tenant was added manually.</div>
            )}
            <div className="flex justify-end">
              <button onClick={onClose} className="bg-slate-800 text-white px-4 py-2 rounded-lg">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
