export default function ScreenshotModal({ url, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300">✕</button>
        <img src={url} alt="Screenshot" className="w-full rounded-lg shadow-2xl" />
      </div>
    </div>
  )
}
