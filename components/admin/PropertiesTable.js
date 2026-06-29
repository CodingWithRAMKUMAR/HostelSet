import { formatDate } from '../../lib/utils'

export default function PropertiesTable({ properties, selectedProperties, setSelectedProperties, paginate, currentPage, setCurrentPage, itemsPerPage, totalItems, onGrant, onRevoke, onDelete }) {
  const toggleSelectAll = (e) => {
    if (e.target.checked) setSelectedProperties(properties)
    else setSelectedProperties([])
  }

  return (
    <div className="bg-gray-900 rounded-2xl shadow-xl overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-800 border-b border-gray-700">
          <tr>
            <th className="px-4 py-3"><input type="checkbox" onChange={toggleSelectAll} checked={selectedProperties.length === properties.length && properties.length > 0} /></th>
            <th className="px-4 py-3 text-left">Property</th>
            <th className="px-4 py-3 text-left">Owner</th>
            <th className="px-4 py-3 text-left">City</th>
            <th className="px-4 py-3 text-left">Membership</th>
            <th className="px-4 py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginate(properties).map(p => (
            <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/50">
              <td className="px-4 py-3"><input type="checkbox" checked={selectedProperties.some(sp => sp.id === p.id)} onChange={e => {
                if (e.target.checked) setSelectedProperties([...selectedProperties, p])
                else setSelectedProperties(selectedProperties.filter(sp => sp.id !== p.id))
              }} /></td>
              <td className="px-4 py-3 font-medium">{p.name}</td>
              <td className="px-4 py-3 text-gray-400">{p.users?.full_name || 'N/A'}<br/><span className="text-xs">{p.users?.email}</span></td>
              <td className="px-4 py-3">{p.city}</td>
              <td className="px-4 py-3">{p.membership_active ? <span className="text-green-400">Active until {formatDate(p.membership_expiry)}</span> : <span className="text-red-400">Inactive</span>}</td>
              <td className="px-4 py-3 flex gap-2">
                {p.membership_active ? (
                  <button onClick={() => onRevoke(p.owner_id)} className="bg-red-700 hover:bg-red-600 px-2 py-1 rounded text-xs">Revoke</button>
                ) : (
                  <button onClick={() => onGrant(p.owner_id, p.users?.full_name || 'Owner')} className="bg-purple-700 hover:bg-purple-600 px-2 py-1 rounded text-xs">Grant</button>
                )}
                <button onClick={() => onDelete(p.id, p.name)} className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between p-4">
        <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50">Prev</button>
        <span>Page {currentPage} of {Math.ceil(totalItems/itemsPerPage)}</span>
        <button onClick={() => setCurrentPage(p => p+1)} disabled={currentPage>=Math.ceil(totalItems/itemsPerPage)} className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50">Next</button>
      </div>
    </div>
  )
}
