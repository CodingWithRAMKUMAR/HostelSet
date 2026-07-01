import { useEffect, useState } from 'react'

export default function ScreenshotModal({ url = '', onClose = () => {} }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    const handleKeyDown = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [url, onClose])

  if (!url) return null
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Payment proof preview">
      <div className="relative max-w-5xl w-full flex items-center justify-center" onClick={event => event.stopPropagation()}>
        <button onClick={onClose} aria-label="Close preview" className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300">×</button>
        {failed ? <div className="rounded-xl bg-white p-8 text-center text-slate-700">This payment proof is unavailable or its secure link has expired. Close and open it again to retry.</div> : <img src={url} onError={() => setFailed(true)} alt="Payment proof" className="max-w-full max-h-[88vh] object-contain rounded-lg shadow-2xl" />}
      </div>
    </div>
  )
}
