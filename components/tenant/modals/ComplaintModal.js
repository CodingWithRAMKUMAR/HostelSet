import { motion } from 'framer-motion'
import { useModalAccessibility } from '../../../hooks/useModalAccessibility'

export default function ComplaintModal({
  complaintForm = {},
  setComplaintForm = () => {},
  isSubmitting = false,
  onSubmit = () => {},
  onCancel = () => {},
}) {
  const dialogRef = useModalAccessibility(onCancel, isSubmitting)
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { if (!isSubmitting) onCancel() }}>
      <motion.div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="complaint-modal-title" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="bg-white rounded-2xl max-w-md w-full p-6 outline-none" onClick={(e) => e.stopPropagation()}>
        <h2 id="complaint-modal-title" className="text-2xl font-bold mb-4">📝 Raise Complaint</h2>
        <div className="space-y-4">
          <input type="text" placeholder="Title" className="w-full px-4 py-3 border rounded-xl" value={complaintForm.title} onChange={e => setComplaintForm({...complaintForm, title: e.target.value})} />
          <textarea placeholder="Description" rows="4" className="w-full px-4 py-3 border rounded-xl" value={complaintForm.description} onChange={e => setComplaintForm({...complaintForm, description: e.target.value})} />
          <select className="w-full px-4 py-3 border rounded-xl" value={complaintForm.priority} onChange={e => setComplaintForm({...complaintForm, priority: e.target.value})}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
          <div className="flex gap-3 mt-6"><button onClick={onSubmit} disabled={isSubmitting} className="flex-1 bg-orange-600 text-white py-3 rounded-xl disabled:opacity-50">{isSubmitting ? 'Submitting...' : 'Submit Complaint'}</button><button onClick={onCancel} disabled={isSubmitting} className="flex-1 border-2 border-gray-300 py-3 rounded-xl disabled:opacity-50">Cancel</button></div>
        </div>
      </motion.div>
    </div>
  )
}
