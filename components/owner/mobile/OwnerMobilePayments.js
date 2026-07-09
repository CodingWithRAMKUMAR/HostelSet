import NotificationBell from '../../common/NotificationBell'
import { formatCurrency, formatDate } from '../../../lib/utils'

function Header({ onBack, title, subtitle, avatar, onProfile }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 px-3 pt-[calc(env(safe-area-inset-top)_+_0.375rem)] pb-1.5 text-white">
      <div className="flex min-h-[46px] items-center gap-2">
        <button type="button" onClick={onBack} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg" aria-label="Back">&larr;</button>
        <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-black leading-tight">{title}</p>{subtitle && <p className="truncate text-[10px] font-medium leading-tight text-slate-400">{subtitle}</p>}</div>
        <NotificationBell listenForGlobalOpen />
        <button type="button" onClick={onProfile} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-sm font-bold" aria-label="Open account menu">{avatar}</button>
      </div>
    </header>
  )
}

export default function OwnerMobilePayments({ payments = [], property, avatar = 'O', onBack, onProfile, onConfirm, onReject, onViewScreenshot, isSubmitting }) {
  return (
    <div className="min-h-dvh max-w-full overflow-x-hidden bg-slate-50 pb-[calc(5.75rem_+_env(safe-area-inset-bottom))]">
      <Header title="Payments" subtitle={property?.name} avatar={avatar} onBack={onBack} onProfile={onProfile} />
      <main className="mx-auto max-w-md space-y-2.5 px-3 py-2.5">
        {payments.length === 0 ? <div className="rounded-2xl bg-white p-4 text-center text-sm text-slate-500">No pending payments.</div> : payments.map(payment => (
          <div key={payment.id} className="rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{payment.tenants?.name || 'N/A'}</p>
                <p className="text-[11px] text-slate-500">Room {payment.tenants?.rooms?.room_number || 'N/A'} · {formatDate(payment.payment_date)}</p>
              </div>
              <p className="shrink-0 text-sm font-black text-emerald-600">{formatCurrency(payment.amount)}</p>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              {payment.payment_screenshot ? <button onClick={() => onViewScreenshot(payment)} className="text-xs font-semibold text-blue-600">Proof</button> : <span className="text-xs text-slate-400">No proof</span>}
              <div className="flex gap-2">
                <button disabled={isSubmitting} onClick={() => onConfirm(payment.id, payment.tenant_id, payment.amount)} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-50">Received</button>
                <button disabled={isSubmitting} onClick={() => onReject(payment.id)} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-600 disabled:opacity-50">Reject</button>
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
