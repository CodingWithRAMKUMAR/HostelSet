import NotificationBell from '../../common/NotificationBell'
import DashboardIcon from '../../dashboard/DashboardIcon'
import { formatCurrency, formatDate } from '../../../lib/utils'

function Header({ onBack }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 px-3 pt-[calc(env(safe-area-inset-top)_+_0.25rem)] pb-1 text-white">
      <div className="flex min-h-[42px] items-center gap-2">
        <button type="button" onClick={onBack} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base" aria-label="Back">←</button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-black leading-tight">Payments</p>
          <p className="truncate text-[10px] font-medium leading-tight text-slate-400">Pending rent confirmations</p>
        </div>
        <NotificationBell listenForGlobalOpen />
      </div>
    </header>
  )
}

export default function OwnerMobilePayments({ payments = [], onBack, onConfirm, onReject, onViewScreenshot, isSubmitting }) {
  const total = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const withProof = payments.filter(payment => payment.payment_screenshot).length

  return (
    <div className="min-h-dvh max-w-full overflow-x-hidden bg-slate-950 pb-[calc(5.1rem_+_env(safe-area-inset-bottom))]">
      <Header onBack={onBack} />
      <main className="mx-auto max-w-md space-y-2 px-3 py-2">
        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-3xl border border-white/10 bg-slate-900 p-2.5 text-white">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pending</p>
            <p className="text-lg font-black">{payments.length}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900 p-2.5 text-white">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Amount</p>
            <p className="truncate text-lg font-black">{formatCurrency(total)}</p>
          </div>
        </section>
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Recent requests</p>
          <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] font-black text-slate-300">{withProof} proofs</span>
        </div>
        {payments.length === 0 ? <div className="rounded-2xl bg-white/8 p-4 text-center text-sm text-slate-400">No pending payments.</div> : payments.map(payment => (
          <article key={payment.id} className="rounded-3xl border border-white/10 bg-white p-2.5 shadow-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><DashboardIcon name="payments" className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-900">{payment.tenants?.name || 'N/A'}</p>
                <p className="truncate text-[11px] text-slate-500">Room {payment.tenants?.rooms?.room_number || 'N/A'} · {formatDate(payment.payment_date)}</p>
              </div>
              <p className="shrink-0 text-sm font-black text-emerald-600">{formatCurrency(payment.amount)}</p>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 pl-11">
              {payment.payment_screenshot ? <button onClick={() => onViewScreenshot(payment)} className="text-xs font-bold text-blue-600">Proof</button> : <span className="text-xs text-slate-400">No proof</span>}
              <div className="flex gap-1.5">
                <button disabled={isSubmitting} onClick={() => onConfirm(payment.id, payment.tenant_id, payment.amount)} className="h-8 rounded-xl bg-emerald-600 px-2 text-xs font-black text-white disabled:opacity-50">Received</button>
                <button disabled={isSubmitting} onClick={() => onReject(payment.id)} className="h-8 rounded-xl bg-red-50 px-2 text-xs font-black text-red-600 disabled:opacity-50">Reject</button>
              </div>
            </div>
          </article>
        ))}
      </main>
    </div>
  )
}
