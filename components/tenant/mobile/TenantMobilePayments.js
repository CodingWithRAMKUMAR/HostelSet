import NotificationBell from '../../common/NotificationBell'
import { formatCurrency, formatDate } from '../../../lib/utils'

function Header({ onBack, title, subtitle, avatar, onProfile }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 px-3 pt-[calc(env(safe-area-inset-top)_+_0.375rem)] pb-1.5 text-white">
      <div className="flex min-h-[42px] items-center gap-2">
        <button type="button" onClick={onBack} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base" aria-label="Back">&larr;</button>
        <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-black leading-tight">{title}</p>{subtitle && <p className="truncate text-[10px] font-medium leading-tight text-slate-400">{subtitle}</p>}</div>
        <NotificationBell listenForGlobalOpen />
        <button type="button" onClick={onProfile} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-xs font-bold" aria-label="Open account menu">{avatar}</button>
      </div>
    </header>
  )
}

export default function TenantMobilePayments({ payments = [], property, avatar = 'U', onBack, onProfile, onPayRent, onViewScreenshot }) {
  return (
    <div className="min-h-dvh max-w-full overflow-x-hidden bg-slate-950 pb-[calc(5.1rem_+_env(safe-area-inset-bottom))]">
      <Header title="Payments" subtitle={property?.name} avatar={avatar} onBack={onBack} onProfile={onProfile} />
      <main className="mx-auto max-w-md space-y-2 px-3 py-2">
        <button type="button" onClick={onPayRent} className="h-8 w-full rounded-xl bg-orange-500 px-3 text-xs font-black text-white shadow-sm">Pay rent with UPI</button>
        {payments.length === 0 ? <div className="rounded-2xl bg-white p-4 text-center text-sm text-slate-500">No payment history yet.</div> : payments.map(payment => (
          <div key={payment.id} className="rounded-2xl border border-white/10 bg-white p-2.5 shadow-sm">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-black leading-tight text-slate-900">{formatCurrency(payment.amount || 0)}</p>
                <p className="text-[11px] text-slate-500">{formatDate(payment.payment_date)}</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">{payment.status || 'pending'}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="truncate text-xs capitalize text-slate-500">{String(payment.payment_method || 'rent').replaceAll('_', ' ')} · {payment.upi_transaction_id || '—'}</p>
              {payment.payment_screenshot && <button type="button" onClick={() => onViewScreenshot(payment)} className="text-xs font-bold text-blue-600">Proof</button>}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
