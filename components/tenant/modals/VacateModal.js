import { formatCurrency } from '../../../lib/utils'

export default function VacateModal({
  vacateForm,
  setVacateForm,
  ratingHover,
  setRatingHover,
  isSubmitting,
  tenant,
  onSubmit,
  onCancel,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4">🚪 Request Vacate</h2>
        <div className="space-y-4">
          <div><label className="block text-sm font-semibold mb-2">Expected Check-out Date *</label><input type="date" className="w-full px-4 py-3 border rounded-xl" value={vacateForm.expected_date} onChange={e => setVacateForm({...vacateForm, expected_date: e.target.value})} min={new Date().toISOString().split('T')[0]} /></div>
          <div><label className="block text-sm font-semibold mb-2">Reason (optional)</label><textarea placeholder="e.g., Moving to another city" rows="3" className="w-full px-4 py-3 border rounded-xl" value={vacateForm.reason} onChange={e => setVacateForm({...vacateForm, reason: e.target.value})} /></div>
          <div className="bg-yellow-50 p-3 rounded-lg"><p className="text-xs text-yellow-700">⚠️ Please clear all pending dues before vacating</p>{tenant?.pending_amount > 0 && <p className="text-xs text-red-600 mt-1">⚠️ You have pending dues: {formatCurrency(tenant.pending_amount)}</p>}</div>
          <div className="border-t pt-4">
            <label className="block text-sm font-semibold mb-2">Rate your experience *</label>
            <div className="flex gap-1 mb-2">{[...Array(5)].map((_, i) => (<button key={i} type="button" onClick={() => setVacateForm({...vacateForm, rating: i+1})} onMouseEnter={() => setRatingHover(i+1)} onMouseLeave={() => setRatingHover(0)} className="text-3xl"><span className={i+1 <= (vacateForm.rating || ratingHover) ? 'text-yellow-500' : 'text-gray-300'}>★</span></button>))}</div>
            <textarea placeholder="Optional review" rows="2" className="w-full px-4 py-3 border rounded-xl" value={vacateForm.review} onChange={e => setVacateForm({...vacateForm, review: e.target.value})} />
          </div>
          <div className="flex gap-3 mt-6"><button onClick={onSubmit} disabled={isSubmitting || !vacateForm.expected_date || vacateForm.rating === 0} className="flex-1 bg-red-600 text-white py-3 rounded-xl">{isSubmitting ? 'Submitting...' : 'Submit Request & Rating'}</button><button onClick={onCancel} className="flex-1 border-2 border-gray-300 py-3 rounded-xl">Cancel</button></div>
        </div>
      </div>
    </div>
  )
}
