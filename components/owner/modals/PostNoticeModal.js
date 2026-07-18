import { useEffect, useRef, useState } from 'react'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

export default function PostNoticeModal({ noticeForm, setNoticeForm, onPost, onCancel, isSubmitting }) {
  const [imagePreview, setImagePreview] = useState('')
  const [imageError, setImageError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!noticeForm.image_file) {
      setImagePreview('')
      return undefined
    }

    const previewUrl = URL.createObjectURL(noticeForm.image_file)
    setImagePreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [noticeForm.image_file])

  const selectImage = event => {
    const file = event.target.files?.[0] || null
    setImageError('')

    if (!file) {
      setNoticeForm(current => ({ ...current, image_file: null }))
      return
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Use a JPEG, PNG, WEBP, or GIF image.')
      setNoticeForm(current => ({ ...current, image_file: null }))
      event.target.value = ''
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setImageError('The image must be smaller than 5 MB.')
      setNoticeForm(current => ({ ...current, image_file: null }))
      event.target.value = ''
      return
    }

    setNoticeForm(current => ({ ...current, image_file: file }))
  }

  const removeImage = () => {
    setImageError('')
    setNoticeForm(current => ({ ...current, image_file: null }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onCancel}>
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Post Notice</h2>
          <p className="mt-0.5 text-xs text-slate-500">Share an announcement with tenants at this property.</p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
          <input
            type="text"
            placeholder="Title *"
            maxLength={160}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            value={noticeForm.title}
            onChange={(e) => setNoticeForm({...noticeForm, title: e.target.value})}
          />
          <textarea
            placeholder="Content *"
            rows="3"
            maxLength={5000}
            className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            value={noticeForm.content}
            onChange={(e) => setNoticeForm({...noticeForm, content: e.target.value})}
          />
          <select
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            value={noticeForm.type}
            onChange={(e) => setNoticeForm({...noticeForm, type: e.target.value})}
          >
            <option value="general">General</option>
            <option value="maintenance">Maintenance</option>
            <option value="payment">Payment</option>
            <option value="event">Event</option>
            <option value="emergency">Emergency</option>
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={noticeForm.is_urgent}
              onChange={(e) => setNoticeForm({...noticeForm, is_urgent: e.target.checked})}
              className="w-4 h-4"
            />
            <span className="text-sm">Mark as Urgent</span>
          </label>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700" htmlFor="owner-notice-image">Optional image</label>
            <input
              id="owner-notice-image"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={selectImage}
              disabled={isSubmitting}
              className="block w-full rounded-xl border border-gray-200 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:font-semibold file:text-orange-700"
            />
            <p className="text-xs text-slate-500">JPEG, PNG, WEBP, or GIF. Maximum 5 MB.</p>
            {imageError && <p className="text-xs font-semibold text-red-600">{imageError}</p>}
          </div>
          {imagePreview && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <img src={imagePreview} alt="Selected notice preview" className="h-36 w-full object-contain sm:h-44" />
              <button type="button" onClick={removeImage} disabled={isSubmitting} className="w-full border-t border-slate-200 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-50">
                Remove image
              </button>
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-slate-100 bg-white px-4 py-3 sm:px-5">
          <button onClick={onPost} disabled={isSubmitting || Boolean(imageError)} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {isSubmitting ? (noticeForm.image_file ? 'Uploading...' : 'Posting...') : 'Post Notice'}
          </button>
          <button onClick={onCancel} disabled={isSubmitting} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
