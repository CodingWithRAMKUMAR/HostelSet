import { useEffect, useState } from 'react'

export default function ScreenshotModal({ url, onClose }) {
  const [failed, setFailed] = useState(false)
  const pdf = (() => {
    try { return decodeURIComponent(new URL(url).pathname).toLowerCase().endsWith('.pdf') }
    catch { return false }
  })()

  useEffect(() => {
    setFailed(false)
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [url, onClose])

  if (!url) return null
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Payment screenshot preview">
      <div className="relative max-w-5xl w-full max-h-[92vh] flex items-center justify-center" onClick={event => event.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300" aria-label="Close preview">×</button>
        {failed ? (
          <div className="rounded-xl bg-white p-8 text-center text-slate-700">This screenshot is unavailable or its secure link has expired. Close this preview and open it again to retry.</div>
        ) : pdf ? (
          <div className="flex h-[88vh] w-full flex-col overflow-hidden rounded-lg bg-white">
            <iframe src={url} title="Private document preview" className="min-h-0 flex-1" onError={() => setFailed(true)} />
            <a href={url} target="_blank" rel="noopener noreferrer" className="border-t p-3 text-center font-semibold text-blue-700">Open PDF in a new tab</a>
          </div>
        ) : (
          <img src={url} alt="Payment screenshot" onError={() => setFailed(true)} className="max-w-full max-h-[88vh] object-contain rounded-lg shadow-2xl" />
        )}
      </div>
    </div>
  )
}
