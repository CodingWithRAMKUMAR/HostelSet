import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const VIEWPORT_PADDING = 12
const MENU_WIDTH = 160

export default function RoomActionMenu({ room, open, onToggle, onEdit, onDelete, deleteDisabled = false, disabled = false }) {
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const [position, setPosition] = useState({ left:VIEWPORT_PADDING, top:VIEWPORT_PADDING })

  const openMenu = event => {
    event.stopPropagation()
    if (open) return onToggle(false)
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const left = Math.max(VIEWPORT_PADDING, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING))
      const estimatedHeight = onEdit ? 92 : 48
      const top = rect.bottom + 6 + estimatedHeight <= window.innerHeight - VIEWPORT_PADDING ? rect.bottom + 6 : Math.max(VIEWPORT_PADDING, rect.top - estimatedHeight - 6)
      setPosition({ left, top })
    }
    onToggle(true)
  }

  useEffect(() => {
    if (!open) return undefined
    const close = event => {
      if (event.type === 'keydown' && event.key === 'Escape') { onToggle(false); triggerRef.current?.focus(); return }
      if (event.type === 'pointerdown' && !triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) onToggle(false)
    }
    const closeForViewportChange = () => onToggle(false)
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', close)
    window.addEventListener('resize', closeForViewportChange)
    window.addEventListener('scroll', closeForViewportChange, true)
    return () => {
      document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close)
      window.removeEventListener('resize', closeForViewportChange); window.removeEventListener('scroll', closeForViewportChange, true)
    }
  }, [open, onToggle])

  const menu = open && typeof document !== 'undefined' ? createPortal(
    <div ref={menuRef} role="menu" aria-label={`Room ${room.room_number} actions`} style={{ left:position.left, top:position.top, minWidth:MENU_WIDTH, maxWidth:'calc(100vw - 24px)' }} className="fixed z-[10000] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-2xl" onClick={event => event.stopPropagation()}>
      {onEdit && <button type="button" role="menuitem" onClick={() => { onToggle(false); onEdit(room) }} className="block w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">Edit Room</button>}
      <button type="button" role="menuitem" disabled={deleteDisabled || disabled} onClick={() => { onToggle(false); onDelete(room) }} className="block w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:text-slate-400">Delete Room</button>
    </div>, document.body) : null

  return <div className="shrink-0" onClick={event => event.stopPropagation()}>
    <button ref={triggerRef} type="button" disabled={disabled} onClick={openMenu} aria-label="Room actions" aria-expanded={open} aria-haspopup="menu" className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-black leading-none text-slate-600 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 disabled:opacity-50">⋮</button>
    {menu}
  </div>
}
