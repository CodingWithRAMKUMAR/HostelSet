import { useEffect, useRef } from 'react'
export default function AccountMenu({ open, onClose, name, subtitle, avatar = 'U', actions = [] }) {
  const ref = useRef(null)
  useEffect(() => { if (!open) return; const close = e => { if (e.key === 'Escape' || (e.type === 'pointerdown' && !ref.current?.contains(e.target))) onClose() }; document.addEventListener('keydown', close); document.addEventListener('pointerdown', close); return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close) } }, [open, onClose])
  if (!open) return null
  return <div ref={ref} role="menu" className="dashboard-account-menu"><div className="flex min-w-0 items-center gap-3 border-b border-slate-200 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 font-bold text-white">{avatar}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{name}</p><p className="truncate text-xs text-slate-500">{subtitle}</p></div></div><div className="p-2">{actions.map(action => <button key={action.label} type="button" role="menuitem" onClick={() => { action.onClick(); onClose() }} className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-slate-100 ${action.danger ? 'text-red-600' : 'text-slate-700'}`}>{action.label}</button>)}</div></div>
}
