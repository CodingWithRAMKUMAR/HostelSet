import { useEffect, useRef, useState } from 'react'

export default function RoommateContactDialog({ roommate, onClose }) {
  const closeButtonRef = useRef(null)
  const [copyStatus, setCopyStatus] = useState('')

  useEffect(() => {
    if (!roommate) return undefined
    closeButtonRef.current?.focus()
    const onKeyDown = event => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [roommate, onClose])

  if (!roommate) return null
  const copyNumber = async () => {
    if (!roommate.phone) return
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(roommate.phone)
      else {
        const input = document.createElement('textarea')
        input.value = roommate.phone
        input.setAttribute('readonly', '')
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        input.remove()
      }
      setCopyStatus('Number copied')
      window.setTimeout(() => setCopyStatus(''), 2000)
    } catch { setCopyStatus('Unable to copy number') }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="roommate-contact-title" className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300">Roommate</p><h2 id="roommate-contact-title" className="break-words text-lg font-black">{roommate.name || 'Roommate'}</h2></div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close roommate details" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-xl focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-slate-600">&times;</button>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">Phone number</p>
          <p className="mt-1 break-all font-semibold">{roommate.phone || 'Phone number unavailable'}</p>
        </div>
        {roommate.phone && <div className="mt-4 grid grid-cols-2 gap-2"><a href={`tel:${roommate.phone}`} aria-label={`Call ${roommate.name || 'roommate'}`} className="rounded-xl bg-orange-500 px-3 py-2 text-center text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-orange-500">Call</a><button type="button" onClick={copyNumber} aria-label={`Copy phone number for ${roommate.name || 'roommate'}`} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold focus-visible:ring-2 focus-visible:ring-orange-500 dark:border-slate-600">Copy Number</button></div>}
        {copyStatus && <p className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300" role="status">{copyStatus}</p>}
      </section>
    </div>
  )
}
