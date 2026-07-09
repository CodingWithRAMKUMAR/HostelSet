import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function AccountMenu({ open, onClose, name, subtitle, avatar = 'U', actions = [] }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = event => {
      if (event.key === 'Escape' || (event.type === 'pointerdown' && !ref.current?.contains(event.target))) onClose()
    }
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', close)
    return () => {
      document.removeEventListener('keydown', close)
      document.removeEventListener('pointerdown', close)
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[10000] pointer-events-none" role="presentation">
      <div ref={ref} role="menu" className="pointer-events-auto fixed right-3 top-[calc(env(safe-area-inset-top)_+_3.75rem)] w-[min(18rem,calc(100vw_-_1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
        <div className="flex min-w-0 items-center gap-3 border-b border-slate-200 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 font-bold text-white">{avatar}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{name}</p>
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="p-2">
          {actions.map((action, index) => (
            <button key={`${action.label}-${index}`} type="button" role="menuitem" onClick={() => { action.onClick(); onClose() }} className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-slate-100 ${action.danger ? 'text-red-600' : 'text-slate-700'}`}>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
