import MobileTopbar from '../../dashboard/MobileTopbar'
import { formatCurrency, formatDate } from '../../../lib/utils'

function Header({ onBack, title, subtitle, avatar, avatarUrl, avatarAlt, onProfile }) {
  return (
    <MobileTopbar title={title} subtitle={subtitle} isHome={false} onBack={onBack} onProfile={onProfile} avatar={avatar} avatarUrl={avatarUrl} avatarAlt={avatarAlt} />
  )
}

export default function TenantMobilePayments({ payments = [], property, avatar = 'U', avatarUrl, avatarAlt, onBack, onProfile, onPayRent, onViewScreenshot }) {
  return (
    <div className="max-w-full overflow-x-hidden bg-slate-950 pb-[calc(5.1rem_+_env(safe-area-inset-bottom))]">
      <Header title="Payments" subtitle={property?.name} avatar={avatar} avatarUrl={avatarUrl} avatarAlt={avatarAlt} onBack={onBack} onProfile={onProfile} />
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
