import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function ComplaintsList({ complaints, loadAllData }) {
  const handleDelete = async (id) => {
    if (!confirm('Delete this complaint?')) return
    const { error } = await supabase.from('complaints').delete().eq('id', id)
    if (error) toast.error('Failed to delete')
    else { toast.success('Deleted'); loadAllData(true) }
  }
  if (!complaints.length) return <p className="text-center text-gray-500">No complaints</p>
  return (
    <div className="space-y-4">
      {complaints.map(c => (
        <div key={c.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex justify-between items-start">
          <div>
            <p className="font-semibold">{c.title}</p>
            <p className="text-sm text-gray-400">From: {c.tenants?.name || c.tenant_name}</p>
            <p className="text-sm">{c.description}</p>
            <span className={`px-2 py-1 rounded-full text-xs ${c.status === 'open' ? 'bg-red-800 text-red-200' : c.status === 'in_progress' ? 'bg-yellow-800 text-yellow-200' : 'bg-green-800 text-green-200'}`}>{c.status}</span>
          </div>
          <button onClick={() => handleDelete(c.id)} className="text-red-400 text-sm">Delete</button>
        </div>
      ))}
    </div>
  )
}
