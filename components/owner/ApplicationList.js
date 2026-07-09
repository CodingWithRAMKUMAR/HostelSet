import { motion } from 'framer-motion';
import { formatDate } from '../../lib/utils';
import { displayBloodGroup } from '../../lib/bloodGroups';

export default function ApplicationList({
  applications,
  onApprove,
  onReject,
  onResendEmail,
  onViewScreenshot,
  isSubmitting
}) {
  if (!applications || applications.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <div className="text-4xl mb-4">📋</div>
        <h3 className="text-lg font-medium text-gray-600">No pending applications</h3>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {applications.map((app) => {
        const monthlyRent = Number(app.rooms?.monthly_rent || 0);
        const securityDeposit = Number(app.payment_amount || app.rooms?.deposit_amount || 0);
        const paymentStatus = String(app.payment_status || 'pending_owner_verification').replaceAll('_', ' ');
        const paymentProofUrl = app.payment_screenshot_url || null;
        return (
          <motion.div
            key={app.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition"
          >
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-semibold text-gray-800">{app.name}</h4>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Application</span>
              </div>
              <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                📞 {app.phone}
              </p>
              {app.email && (
                <p className="text-sm text-gray-500 mt-1">
                  Email: {app.email}
                </p>
              )}
              <p className="text-sm text-gray-500 mt-1">Blood group: {displayBloodGroup(app.blood_group)}</p>
              <p className="text-xs text-gray-400 mt-1">
                Applied: {formatDate(app.created_at)}
              </p>
              {app.rooms?.room_number && (
                <p className="text-xs text-gray-400 mt-1">
                  Room applied for: {app.rooms.room_number}
                </p>
              )}
              <div className="mt-3 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
                <span>Monthly rent: Rs {monthlyRent.toLocaleString('en-IN')}</span>
                <span>Security deposit: Rs {securityDeposit.toLocaleString('en-IN')}</span>
                <span>UTR: {app.payment_transaction_id || 'Not provided'}</span>
                <span>Payment date: {formatDate(app.payment_date || app.created_at)}</span>
                <span className="capitalize">Payment status: {paymentStatus}</span>
                <span className="sm:col-span-2 text-gray-500">Deposit is tracked separately from rent.</span>
              </div>
              {paymentProofUrl && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => onViewScreenshot?.(app)}
                    className="group block w-36 overflow-hidden rounded-lg border border-gray-200 text-left"
                  >
                    <img
                      src={paymentProofUrl}
                      alt="Application payment screenshot"
                      className="h-24 w-full object-cover transition group-hover:opacity-80"
                    />
                    <span className="block px-2 py-1 text-xs font-semibold text-blue-700">View payment proof</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-2 w-full md:w-auto flex-wrap">
              <button
                onClick={() => onApprove(app.id, app)}
                disabled={isSubmitting}
                className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              >
                Approve →
              </button>
              <button
                onClick={() => onResendEmail(app.email)}
                disabled={isSubmitting || !app.email}
                className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              >
                📧 Resend
              </button>
              <button
                onClick={() => onReject(app.id)}
                disabled={isSubmitting}
                className="flex-1 md:flex-none bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
