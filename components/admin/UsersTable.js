export default function UsersTable({ users, onRoleChange, onDelete }) {
  return (
    <div className="bg-gray-900 rounded-2xl shadow-xl overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-800 border-b">
          <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-b border-gray-800">
              <td className="px-4 py-3">{u.full_name}</td>
              <td>{u.email}</td>
              <td>{u.phone}</td>
              <td>
                <select value={u.role} onChange={e => onRoleChange(u.id, e.target.value)} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm">
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                  <option value="tenant">Tenant</option>
                </select>
              </td>
              <td><button onClick={() => onDelete(u.id, u.full_name)} className="text-red-400 text-sm">Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
