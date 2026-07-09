import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock'

export default function OwnerMobileTenantActionsSheet({ tenant, onClose, onCollect, onHistory, onProfile, onConfirmPayment, onDelete }) {
  useBodyScrollLock(Boolean(tenant))
  if (!tenant) return null

  const actions = [
    ['Collect rent', () => onCollect?.(tenant)],
    ['Payment history', () => onHistory?.(tenant)],
    ['Tenant profile', () => onProfile?.(tenant)],
    ['Confirm payment', () => onConfirmPayment?.(tenant)],
    ['Delete / Archive', () => onDelete?.(tenant), true],
  ]

  return (
    <div className="fixed inset-0 z-[110] flex items-end bg-black/60 lg:hidden" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full rounded-t-3xl border border-white/10 bg-slate-950 p-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] text-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-black">{tenant.name?.charAt(0) || '?'}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{tenant.name || 'Tenant'}</p>
            <p className="truncate text-[11px] text-slate-400">Room {tenant.room_number || tenant.room_id || 'N/A'} · {tenant.phone || 'No phone'}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-slate-300" aria-label="Close">×</button>
        </div>
        <div className="grid gap-1.5">
          {actions.map(([label, action, danger]) => (
            <button key={label} type="button" onClick={() => { onClose?.(); requestAnimationFrame(action) }} className={`flex h-10 items-center justify-between rounded-2xl px-3 text-left text-sm font-bold ${danger ? 'bg-red-500/10 text-red-300' : 'bg-white/8 text-slate-100'}`}>
              <span>{label}</span>
              <span className="text-slate-500">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
