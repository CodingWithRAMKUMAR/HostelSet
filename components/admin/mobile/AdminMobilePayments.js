import { formatCurrency } from '../../../lib/utils'
import { AdminEmptyState, AdminLoadingState, AdminMobilePage, AdminStatusChip } from './AdminMobileShell'

function paymentTone(status) {
  if (status === 'success') return 'emerald'
  if (status === 'payment_pending' || status === 'pending') return 'amber'
  return 'red'
}

export default function AdminMobilePayments({ payments = [], loading, actionKey, avatar = 'A', onBack, onProfile, onConfirm, onReject, onViewProof }) {
  return (
    <AdminMobilePage title="Payments" subtitle={`${payments.length} platform payments`} avatar={avatar} onBack={onBack} onProfile={onProfile}>
      {loading && payments.length === 0 ? <AdminLoadingState /> : null}
      {!loading && payments.length === 0 ? <AdminEmptyState>No payments found.</AdminEmptyState> : null}
      {payments.map(payment => {
        const pending = payment.status === 'payment_pending'
        return (
          <article key={payment.id} className="min-w-0 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-black leading-tight text-slate-900">{payment.tenants?.name || 'Unknown tenant'}</p>
                <p className="truncate text-[11px] text-slate-500">{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'No date'}</p>
              </div>
              <p className="shrink-0 text-sm font-black text-emerald-600">{formatCurrency(payment.amount || 0)}</p>
            </div>
            <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
              <AdminStatusChip tone={paymentTone(payment.status)}>{pending ? 'Pending' : payment.status || 'Unknown'}</AdminStatusChip>
              <div className="flex shrink-0 items-center gap-2">
                {payment.payment_screenshot ? (
                  <button type="button" onClick={() => onViewProof?.(payment)} className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                    Proof
                  </button>
                ) : null}
                {pending ? (
                  <>
                  <button type="button" disabled={Boolean(actionKey)} onClick={() => onConfirm?.(payment)} className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 disabled:opacity-50">
                    {actionKey === `payment:${payment.id}` ? '...' : 'Confirm'}
                  </button>
                  <button type="button" disabled={Boolean(actionKey)} onClick={() => onReject?.(payment)} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-600 disabled:opacity-50">
                    {actionKey === `payment:${payment.id}` ? '...' : 'Reject'}
                  </button>
                  </>
                ) : null}
              </div>
            </div>
          </article>
        )
      })}
    </AdminMobilePage>
  )
}
