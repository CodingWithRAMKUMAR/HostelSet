import { memo } from 'react';
import { formatCurrency, formatDate } from '../../lib/utils';

const PaymentsSection = ({ payments = [], onViewScreenshot = () => {} }) => {
  if (payments.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-3">💰</div>
        <p className="font-semibold text-slate-700">No payment history yet</p><p className="mt-1 text-sm text-slate-500">Submitted and verified rent payments will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="space-y-2 p-2 md:hidden">
        {payments.map((payment) => (
          <div key={payment.id} className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight text-slate-900">{formatCurrency(payment.amount)}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(payment.payment_date)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                payment.status === 'success' ? 'bg-green-100 text-green-700' :
                payment.status === 'payment_pending' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {payment.status === 'success' ? 'Success' : payment.status === 'payment_pending' ? 'Pending' : payment.status}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="truncate text-xs capitalize text-slate-500">{String(payment.payment_method || '').replaceAll('_', ' ')} · {payment.upi_transaction_id || '—'}</p>
              {payment.payment_screenshot && <button onClick={() => onViewScreenshot(payment)} className="shrink-0 text-xs font-semibold text-blue-600">View</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Amount</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Method</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">UTR</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Screenshot</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-b hover:bg-gray-50 transition">
                <td className="px-4 py-3 text-sm text-gray-600">{formatDate(payment.payment_date)}</td>
                <td className="px-4 py-3 font-semibold text-green-600">{formatCurrency(payment.amount)}</td>
                <td className="px-4 py-3 text-sm text-gray-500 capitalize">{String(payment.payment_method || '').replaceAll('_', ' ')}</td>
                <td className="px-4 py-3 text-xs text-gray-500 font-mono">{payment.upi_transaction_id || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    payment.status === 'success' ? 'bg-green-100 text-green-700' :
                    payment.status === 'payment_pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {payment.status === 'success' ? 'Success' :
                     payment.status === 'payment_pending' ? 'Pending' :
                     payment.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {payment.payment_screenshot ? (
                    <button
                      onClick={() => onViewScreenshot(payment)}
                      className="text-blue-600 hover:text-blue-800 text-sm underline"
                    >
                      View
                    </button>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default memo(PaymentsSection);
