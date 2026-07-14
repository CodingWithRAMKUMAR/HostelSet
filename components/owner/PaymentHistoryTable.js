import { formatCurrency, formatDate } from '../../lib/utils';
import { useState } from 'react';

function TenantAvatar({ tenant }) {
  const [failed, setFailed] = useState(false)
  if (tenant?.profilePhotoUrl && !failed) {
    return <img src={tenant.profilePhotoUrl} alt={tenant.name ? `${tenant.name} profile photo` : 'Tenant profile photo'} onError={() => setFailed(true)} className="h-8 w-8 shrink-0 rounded-full object-cover" />
  }
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{tenant?.name?.charAt(0) || '?'}</span>
}

export default function PaymentHistoryTable({ payments = [], getRoomNumberById = () => 'N/A', onViewScreenshot = () => {} }) {
  if (!payments || payments.length === 0) {
    return <div className="text-center py-12 bg-gray-50 rounded-xl">No payment records</div>;
  }

  return (
    <>
    <div className="space-y-2 md:hidden">
      {payments.map(p => (
        <div key={p.id} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <TenantAvatar tenant={p.tenants} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-tight text-slate-900">{p.tenants?.name || 'N/A'}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Room {p.tenants?.rooms?.room_number || getRoomNumberById(p.tenants?.room_id)} · {formatDate(p.payment_date)}</p>
            </div>
            <p className="shrink-0 text-sm font-bold text-green-600">{formatCurrency(p.amount)}</p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="truncate text-xs capitalize text-slate-500">{String(p.payment_method || '').replaceAll('_', ' ')}</span>
            <div className="flex shrink-0 items-center gap-2">
              {p.payment_screenshot && <button type="button" onClick={() => onViewScreenshot(p)} className="text-[11px] font-semibold text-blue-600">Proof</button>}
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                p.status === 'success' ? 'bg-green-100 text-green-700' :
                p.status === 'payment_pending' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {p.status === 'success' ? 'Success' : p.status === 'payment_pending' ? 'Pending' : p.status}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Tenant</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Room</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Amount</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Method</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Proof</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(p => (
            <tr key={p.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-500">{formatDate(p.payment_date)}</td>
              <td className="px-4 py-3 font-medium"><span className="flex items-center gap-2"><TenantAvatar tenant={p.tenants} /><span>{p.tenants?.name || 'N/A'}</span></span></td>
              <td className="px-4 py-3 text-gray-600">
                {p.tenants?.rooms?.room_number || getRoomNumberById(p.tenants?.room_id)}
              </td>
              <td className="px-4 py-3 font-semibold text-green-600">{formatCurrency(p.amount)}</td>
              <td className="px-4 py-3 capitalize text-gray-500">{String(p.payment_method || '').replaceAll('_', ' ')}</td>
              <td className="px-4 py-3">{p.payment_screenshot ? <button type="button" onClick={() => onViewScreenshot(p)} className="text-sm font-semibold text-blue-600 underline">View</button> : <span className="text-xs text-gray-400">N/A</span>}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  p.status === 'success' ? 'bg-green-100 text-green-700' :
                  p.status === 'payment_pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {p.status === 'success' ? 'Success' : p.status === 'payment_pending' ? 'Pending' : p.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
