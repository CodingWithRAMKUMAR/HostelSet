import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { displayBloodGroup } from '../../lib/bloodGroups'

const labels = {
  Tenants: item => `${item.name} · ${item.rooms?.room_number ? `Room ${item.rooms.room_number}` : 'No room'} · ${displayBloodGroup(item.blood_group)}`,
  Owners: item => `${item.full_name} · ${item.email || item.phone || 'No contact'}`,
  Properties: item => `${item.name} · ${item.locality || item.city || 'No location'}`,
  Applications: item => `${item.name} · ${item.properties?.name || 'Application'} · ${displayBloodGroup(item.blood_group)}`,
  Imports: item => `${item.full_name} · ${item.room_number ? `Room ${item.room_number}` : 'Import'} · ${displayBloodGroup(item.blood_group)}`,
}

export default function AdminGlobalSearch({ onOpen }) {
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState({})
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    const q = query.trim()
    if (!q) { setGroups({}); setLoading(false); return }
    const current = ++requestId.current
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Session expired')
        const response = await fetch(`/api/admin/global-search?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Search failed')
        if (current === requestId.current) setGroups(data.groups || {})
      } catch { if (current === requestId.current) setGroups({}) }
      finally { if (current === requestId.current) setLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const hasResults = Object.values(groups).some(items => items?.length)
  return <div className="relative mb-6">
    <label htmlFor="admin-global-search" className="sr-only">Search all admin records</label>
    <input id="admin-global-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search tenants, owners, properties, applications, imports…" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" autoComplete="off" />
    {query.trim() && <div className="absolute z-40 mt-2 max-h-[65vh] w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
      {loading ? <p className="p-3 text-sm text-gray-500">Searching…</p> : hasResults ? Object.entries(groups).map(([group, items]) => items?.length ? <section key={group} className="mb-2 last:mb-0"><h3 className="px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-600">{group}</h3>{items.map(item => <button key={`${group}-${item.id}`} type="button" onClick={() => { onOpen(group, item); setQuery(''); setGroups({}) }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50">{labels[group](item)}</button>)}</section> : null) : <p className="p-3 text-sm text-gray-500">No matching records.</p>}
    </div>}
  </div>
}
