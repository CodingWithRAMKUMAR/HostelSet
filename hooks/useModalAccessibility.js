import { useEffect, useRef } from 'react'

export function useModalAccessibility(onClose, closeDisabled = false, enabled = true) {
  const dialogRef = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    if (!enabled) return undefined
    const previousFocus = document.activeElement
    const dialog = dialogRef.current
    dialog?.focus()
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !closeDisabled) closeRef.current?.()
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) { event.preventDefault(); dialog.focus(); return }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => { document.removeEventListener('keydown', handleKeyDown); previousFocus?.focus?.() }
  }, [closeDisabled, enabled])
  return dialogRef
}
