import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase, signPrivateDocumentFields, findTenantDocumentRecord } from '../../lib/supabase'
import { formatCurrency, formatDate } from '../../lib/utils'

const PAGE_SIZE = 15

const matches = (term, ...values) => {
  const needle = term.trim().toLowerCase()
  if (!needle) return true
  return values.some(value => String(value || '').toLowerCase().includes(needle))
}

const statusPill = status => {
  const value = String(status || 'unknown')
  const tone = value.includes('pending') ? 'bg-amber-100 text-amber-800'
    : value.includes('approved') || value.includes('active') || value.includes('success') ? 'bg-emerald-100 text-emerald-800'
    : value.includes('rejected') || value.includes('inactive') ? 'bg-red-100 text-red-800'
    : 'bg-slate-100 text-slate-700'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tone}`}>{value.replaceAll('_', ' ')}</span>
}

function Section({ title, children, actions = null }) {
  return (
    <section className="border-t border-slate-200 py-5 first:border-t-0 first:pt-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  )
}

function DocumentGrid({ documents, onOpen }) {
  const visible = documents.filter(doc => doc.record?.[doc.field])
  if (!visible.length) return <p className="text-sm text-slate-500">No document uploaded.</p>
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {visible.map(doc => (
        <button key={doc.label} onClick={() => onOpen(doc)} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left hover:border-orange-300">
          <p className="text-sm font-semibold text-slate-700">{doc.label}</p>
          <p className="mt-1 truncate text-xs text-blue-700">Open secure document</p>
        </button>
      ))}
    </div>
  )
}

function MiniList({ items, emptyMessage, renderItem }) {
  if (!items.length) return <p className="text-sm text-slate-500">{emptyMessage}</p>
  return <div className="space-y-2">{items.map(renderItem)}</div>
}

const enrichVacateRequests = (vacates, tenants, properties) => {
  const tenantMap = new Map((tenants || []).map(tenant => [tenant.id, tenant]))
  const propertyMap = new Map((properties || []).map(property => [property.id, property]))
  const roomMap = new Map()
  ;(properties || []).forEach(property => {
    ;(property.rooms || []).forEach(room => roomMap.set(room.id, room))
  })

  return (vacates || []).map(vacate => ({
    ...vacate,
    tenants: vacate.tenants || tenantMap.get(vacate.tenant_id) || (vacate.tenant_name ? { name: vacate.tenant_name } : null),
    properties: vacate.properties || propertyMap.get(vacate.property_id) || null,
    rooms: vacate.rooms || roomMap.get(vacate.room_id) || (vacate.room_number ? { room_number: vacate.room_number } : null),
  }))
}

export default function EnterpriseAdminConsole() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ city: 'all', status: 'all', membership: 'all', importStatus: 'pending_owner_review' })
  const [data, setData] = useState({ properties: [], tenants: [], owners: [], payments: [], complaints: [], imports: [], applications: [], roomChanges: [], vacates: [], notices: [] })
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [tenantProfile, setTenantProfile] = useState(null)
  const [tenantLoading, setTenantLoading] = useState(false)
  const [selectedOwner, setSelectedOwner] = useState(null)
  const [ownerProfile, setOwnerProfile] = useState(null)
  const [importPage, setImportPage] = useState(0)
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [loadWarnings, setLoadWarnings] = useState([])

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true)
    else setLoading(true)
    try {
      const loadSection = async (key, label, query) => {
        const result = await query
        if (result.error) {
          if (process.env.NODE_ENV !== 'production') console.warn(`[EnterpriseAdminConsole] ${label} load failed`, result.error)
          return { key, label, data: null, error: result.error }
        }
        return { key, label, data: result.data || [], error: null }
      }

      const results = await Promise.all([
        loadSection('properties', 'Properties', supabase.from('properties').select('*, owner:users!properties_owner_id_fkey(id, full_name, email, phone, is_active), rooms(id, room_number, capacity, current_occupants, monthly_rent, status)').order('created_at', { ascending: false })),
        loadSection('tenants', 'Tenants', supabase.from('tenants').select('*, rooms(id, room_number, capacity, monthly_rent), property:properties!tenants_property_id_fkey(id, name, city, owner_id)').order('created_at', { ascending: false }).limit(500)),
        loadSection('owners', 'Owners', supabase.from('users').select('id, full_name, email, phone, role, is_active, created_at').eq('role', 'owner').order('created_at', { ascending: false }).limit(300)),
        loadSection('payments', 'Payments', supabase.from('payment_history').select('*, tenants(id, name, phone, property_id, property:properties!tenants_property_id_fkey(id, name))').order('payment_date', { ascending: false }).limit(500)),
        loadSection('complaints', 'Complaints', supabase.from('complaints').select('*, tenants(id, name, phone), properties!complaints_property_id_fkey(id, name)').order('created_at', { ascending: false }).limit(300)),
        loadSection('imports', 'Existing Imports', supabase.from('existing_tenant_imports').select('*, properties!existing_tenant_imports_property_id_fkey(id, name, city, owner_id), rooms!existing_tenant_imports_room_id_fkey(id, room_number)').order('created_at', { ascending: false }).limit(500)),
        loadSection('applications', 'Applications', supabase.from('applications').select('*, properties!applications_property_id_fkey(id, name, city), rooms!applications_room_id_fkey(id, room_number)').order('created_at', { ascending: false }).limit(300)),
        loadSection('roomChanges', 'Room Changes', supabase.from('room_change_requests').select('*, tenants(id, name, phone, property_id), old_room:rooms!room_change_requests_old_room_id_fkey(room_number), new_room:rooms!room_change_requests_new_room_id_fkey(room_number)').order('requested_at', { ascending: false }).limit(300)),
        loadSection('vacates', 'Vacate Requests', supabase.from('check_out_requests').select('*').order('created_at', { ascending: false }).limit(300)),
        loadSection('notices', 'Notices', supabase.from('notices').select('*, properties!notices_property_id_fkey(id, name)').order('created_at', { ascending: false }).limit(300)),
      ])

      const warnings = results.filter(result => result.error).map(result => ({ section: result.label, message: result.error.message }))
      setLoadWarnings(warnings)
      setData(current => {
        const next = { ...current }
        results.forEach(result => {
          next[result.key] = result.error ? (current[result.key] || []) : result.data
        })
        next.vacates = enrichVacateRequests(next.vacates, next.tenants, next.properties)
        return next
      })
      if (warnings.length) toast.error(`${warnings.length} admin console section(s) could not load.`)
    } catch (error) {
      toast.error(`Admin console load failed: ${error.message}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const channel = supabase.channel('enterprise-admin-console')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'existing_tenant_imports' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pre_bookings' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_history' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'check_out_requests' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_change_requests' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => load(true))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const cities = useMemo(() => [...new Set(data.properties.map(property => property.city).filter(Boolean))].sort(), [data.properties])
  const selectedProperty = useMemo(() => data.properties.find(property => property.id === selectedPropertyId) || data.properties[0] || null, [data.properties, selectedPropertyId])
  useEffect(() => { if (!selectedPropertyId && data.properties[0]) setSelectedPropertyId(data.properties[0].id) }, [data.properties, selectedPropertyId])

  const filteredProperties = useMemo(() => data.properties.filter(property => {
    if (filters.city !== 'all' && property.city !== filters.city) return false
    if (filters.status !== 'all' && String(Boolean(property.is_active)) !== filters.status) return false
    if (filters.membership === 'active' && !property.membership_active) return false
    if (filters.membership === 'inactive' && property.membership_active) return false
    const propertyTenants = data.tenants.filter(tenant => tenant.property_id === property.id)
    const roomNumbers = (property.rooms || []).map(room => room.room_number)
    return matches(query, property.name, property.city, property.address, property.owner?.full_name, property.owner?.email, property.owner?.phone, property.contact_number, ...roomNumbers, ...propertyTenants.flatMap(tenant => [tenant.name, tenant.phone, tenant.email, tenant.rooms?.room_number]))
  }), [data.properties, data.tenants, filters, query])

  const filteredImports = useMemo(() => data.imports.filter(item => {
    if (filters.importStatus !== 'all' && item.status !== filters.importStatus) return false
    return matches(query, item.full_name, item.phone, item.email, item.properties?.name, item.rooms?.room_number, item.status)
  }), [data.imports, filters.importStatus, query])

  const pagedImports = filteredImports.slice(importPage * PAGE_SIZE, importPage * PAGE_SIZE + PAGE_SIZE)

  const stats = useMemo(() => {
    const capacity = data.properties.flatMap(property => property.rooms || []).reduce((sum, room) => sum + Number(room.capacity || 0), 0)
    const occupied = data.properties.flatMap(property => property.rooms || []).reduce((sum, room) => sum + Number(room.current_occupants || 0), 0)
    const revenue = data.payments.filter(payment => payment.status === 'success').reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const pendingRent = data.payments.filter(payment => payment.status === 'payment_pending').reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    return {
      owners: data.owners.length,
      properties: data.properties.length,
      tenants: data.tenants.length,
      applications: data.applications.length,
      imports: data.imports.length,
      pendingImports: data.imports.filter(item => item.status === 'pending_owner_review').length,
      complaints: data.complaints.filter(item => item.status !== 'resolved').length,
      revenue,
      occupancy: capacity ? `${Math.round((occupied / capacity) * 100)}%` : '0%',
      memberships: data.properties.filter(property => property.membership_active).length,
    }
  }, [data])

  const propertyStats = useMemo(() => {
    if (!selectedProperty) return null
    const rooms = selectedProperty.rooms || []
    const tenants = data.tenants.filter(tenant => tenant.property_id === selectedProperty.id)
    const payments = data.payments.filter(payment => payment.tenants?.property_id === selectedProperty.id)
    const capacity = rooms.reduce((sum, room) => sum + Number(room.capacity || 0), 0)
    const occupied = rooms.reduce((sum, room) => sum + Number(room.current_occupants || 0), 0)
    return {
      capacity,
      occupied,
      vacant: Math.max(0, capacity - occupied),
      rentCollection: payments.filter(payment => payment.status === 'success').reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      pendingRent: payments.filter(payment => payment.status === 'payment_pending').reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      complaints: data.complaints.filter(item => item.property_id === selectedProperty.id).length,
      imports: data.imports.filter(item => item.property_id === selectedProperty.id).length,
      applications: data.applications.filter(item => item.property_id === selectedProperty.id).length,
      roomChanges: data.roomChanges.filter(item => item.tenants?.property_id === selectedProperty.id).length,
      vacates: data.vacates.filter(item => item.property_id === selectedProperty.id).length,
      notices: data.notices.filter(item => !item.property_id || item.property_id === selectedProperty.id).length,
      tenants,
    }
  }, [data, selectedProperty])

  const propertyCollections = useMemo(() => {
    if (!selectedProperty) return null
    const tenants = data.tenants.filter(tenant => tenant.property_id === selectedProperty.id)
    const tenantIds = new Set(tenants.map(tenant => tenant.id))
    return {
      tenants,
      payments: data.payments.filter(payment => tenantIds.has(payment.tenant_id) || payment.tenants?.property_id === selectedProperty.id),
      complaints: data.complaints.filter(item => item.property_id === selectedProperty.id),
      imports: data.imports.filter(item => item.property_id === selectedProperty.id),
      applications: data.applications.filter(item => item.property_id === selectedProperty.id),
      roomChanges: data.roomChanges.filter(item => tenantIds.has(item.tenant_id) || item.tenants?.property_id === selectedProperty.id),
      vacates: data.vacates.filter(item => item.property_id === selectedProperty.id || tenantIds.has(item.tenant_id)),
      notices: data.notices.filter(item => !item.property_id || item.property_id === selectedProperty.id),
    }
  }, [data, selectedProperty])

  const openTenantProfile = async tenant => {
    setSelectedTenant(tenant)
    setTenantProfile(null)
    setTenantLoading(true)
    try {
      const loadTenantSection = async (key, label, query) => {
        const result = await query
        if (result.error) {
          if (process.env.NODE_ENV !== 'production') console.warn(`[EnterpriseAdminConsole] Tenant ${label} load failed`, result.error)
          return { key, label, data: [], error: result.error }
        }
        return { key, label, data: result.data || [], error: null }
      }
      const tenantResults = await Promise.all([
        loadTenantSection('payments', 'payments', supabase.from('payment_history').select('*').eq('tenant_id', tenant.id).order('payment_date', { ascending: false })),
        loadTenantSection('complaints', 'complaints', supabase.from('complaints').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false })),
        loadTenantSection('roomChanges', 'room changes', supabase.from('room_change_requests').select('*, old_room:rooms!room_change_requests_old_room_id_fkey(room_number), new_room:rooms!room_change_requests_new_room_id_fkey(room_number)').eq('tenant_id', tenant.id).order('requested_at', { ascending: false })),
        loadTenantSection('vacates', 'vacates', supabase.from('check_out_requests').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false })),
        loadTenantSection('imports', 'imports', supabase.from('existing_tenant_imports').select('*').eq('property_id', tenant.property_id).or(`tenant_id.eq.${tenant.id},phone.eq.${tenant.phone || ''},email.eq.${tenant.email || ''}`).order('created_at', { ascending: false }).limit(5)),
        loadTenantSection('applications', 'applications', supabase.from('applications').select('*').eq('property_id', tenant.property_id).or(`user_id.eq.${tenant.user_id || '00000000-0000-0000-0000-000000000000'},phone.eq.${tenant.phone || ''},email.eq.${tenant.email || ''}`).order('created_at', { ascending: false }).limit(5)),
      ])
      const tenantData = tenantResults.reduce((acc, result) => ({ ...acc, [result.key]: result.data }), {})
      tenantData.vacates = enrichVacateRequests(tenantData.vacates, [tenant], data.properties)
      const tenantWarnings = tenantResults.filter(result => result.error)
      if (tenantWarnings.length) toast.error(`${tenantWarnings.length} tenant profile section(s) could not load.`)
      const { record, source_type } = await findTenantDocumentRecord(tenant, tenant.property_id)
      const documentRecord = record ? { ...record, source_type } : null
      setTenantProfile({
        payments: tenantData.payments || [],
        complaints: tenantData.complaints || [],
        roomChanges: tenantData.roomChanges || [],
        vacates: tenantData.vacates || [],
        imports: tenantData.imports || [],
        applications: tenantData.applications || [],
        documents: documentRecord ? [
          { label: documentRecord.source_type === 'existing_tenant_import' ? 'Profile Photo' : 'Tenant Photo', record: documentRecord, field: 'photo' },
          { label: 'ID Proof / Aadhaar / PAN', record: documentRecord, field: 'id_proof' },
          { label: 'Payment Proof', record: documentRecord, field: 'payment_screenshot' },
        ] : [],
      })
    } catch (error) {
      toast.error(`Could not load tenant profile: ${error.message}`)
    } finally {
      setTenantLoading(false)
    }
  }

  const openOwnerProfile = owner => {
    const ownerProperties = data.properties.filter(property => property.owner_id === owner.id)
    const ownerPropertyIds = new Set(ownerProperties.map(property => property.id))
    const ownerTenants = data.tenants.filter(tenant => ownerPropertyIds.has(tenant.property_id))
    const tenantIds = new Set(ownerTenants.map(tenant => tenant.id))
    const ownerPayments = data.payments.filter(payment => tenantIds.has(payment.tenant_id) || ownerPropertyIds.has(payment.tenants?.property_id))
    setSelectedOwner(owner)
    setOwnerProfile({
      properties: ownerProperties,
      tenants: ownerTenants,
      payments: ownerPayments,
      applications: data.applications.filter(item => ownerPropertyIds.has(item.property_id)),
      imports: data.imports.filter(item => ownerPropertyIds.has(item.property_id)),
      complaints: data.complaints.filter(item => ownerPropertyIds.has(item.property_id)),
      notices: data.notices.filter(item => ownerPropertyIds.has(item.property_id)),
      revenue: ownerPayments.filter(payment => payment.status === 'success').reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    })
  }

  const openTenantDocument = async ({ record, field }) => {
    const loadingToast = toast.loading('Opening document…')
    try {
      const signed = await signPrivateDocumentFields(record, [field])
      const url = signed?.[field]
      if (!url) return toast.error('This document is unavailable or has been removed.')
      setScreenshotUrl(url)
    } catch {
      toast.error('This document is unavailable or has been removed.')
    } finally {
      toast.dismiss(loadingToast)
    }
  }

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading enterprise console...</div>

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
          <input value={query} onChange={event => { setQuery(event.target.value); setImportPage(0) }} placeholder="Search owner, tenant, property, phone, email, city, room..." className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
          <select value={filters.city} onChange={event => setFilters(current => ({ ...current, city: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All cities</option>
            {cities.map(city => <option key={city} value={city}>{city}</option>)}
          </select>
          <select value={filters.membership} onChange={event => setFilters(current => ({ ...current, membership: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All memberships</option>
            <option value="active">Membership active</option>
            <option value="inactive">Membership inactive</option>
          </select>
          <button onClick={() => load(true)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{refreshing ? 'Refreshing...' : 'Refresh'}</button>
        </div>
        {loadWarnings.length > 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Some admin sections could not refresh: {loadWarnings.map(item => item.section).join(', ')}. Loaded sections remain available.
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Metric label="Owners" value={stats.owners} />
        <Metric label="Properties" value={stats.properties} />
        <Metric label="Tenants" value={stats.tenants} />
        <Metric label="Pending Imports" value={stats.pendingImports} />
        <Metric label="Revenue" value={formatCurrency(stats.revenue)} />
        <Metric label="Applications" value={stats.applications} />
        <Metric label="Existing Imports" value={stats.imports} />
        <Metric label="Complaints" value={stats.complaints} />
        <Metric label="Occupancy" value={stats.occupancy} />
        <Metric label="Memberships" value={stats.memberships} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-lg font-bold text-slate-900">Properties</h2>
            <p className="text-sm text-slate-500">{filteredProperties.length} matching properties</p>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {filteredProperties.map(property => (
              <button key={property.id} onClick={() => setSelectedPropertyId(property.id)} className={`block w-full border-b border-slate-100 p-4 text-left hover:bg-orange-50 ${selectedProperty?.id === property.id ? 'bg-orange-50' : ''}`}>
                <p className="font-semibold text-slate-900">{property.name}</p>
                <p className="text-sm text-slate-500">{property.city || 'City not set'} - {property.owner?.full_name || 'Owner not set'}</p>
                <div className="mt-2 flex gap-2">{statusPill(property.is_active ? 'active' : 'inactive')}{statusPill(property.membership_active ? 'membership active' : 'membership inactive')}</div>
              </button>
            ))}
          </div>
        </section>

        {selectedProperty && propertyStats && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <Section title="Property Information">
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <p><strong>Property Name:</strong> {selectedProperty.name}</p>
                <p><strong>Owner:</strong> {selectedProperty.owner?.full_name || 'N/A'} ({selectedProperty.owner?.email || 'No email'})</p>
                <p><strong>Membership:</strong> {selectedProperty.membership_active ? 'Active' : 'Inactive'} {selectedProperty.membership_expiry ? `until ${formatDate(selectedProperty.membership_expiry)}` : ''}</p>
                <p><strong>Address:</strong> {selectedProperty.address || 'N/A'}</p>
                <p><strong>City:</strong> {selectedProperty.city || 'N/A'}</p>
                <p><strong>Locality:</strong> {selectedProperty.locality || selectedProperty.formatted_address || 'N/A'}</p>
                <p><strong>Coordinates:</strong> {selectedProperty.latitude && selectedProperty.longitude ? `${selectedProperty.latitude}, ${selectedProperty.longitude}` : 'N/A'}</p>
                <p><strong>UPI:</strong> {selectedProperty.owner_upi_id || 'N/A'}</p>
                <p><strong>Contact:</strong> {selectedProperty.contact_number || selectedProperty.owner?.phone || 'N/A'}</p>
                <p><strong>Amenities:</strong> {(selectedProperty.amenities || []).join(', ') || 'N/A'}</p>
              </div>
              {selectedProperty.photos?.length ? <div className="mt-3 flex gap-2 overflow-x-auto">{selectedProperty.photos.map((photo, index) => <img key={photo} src={photo} alt={`${selectedProperty.name} ${index + 1}`} className="h-20 w-28 rounded-lg border object-cover" />)}</div> : <p className="mt-3 text-sm text-slate-500">No photos uploaded.</p>}
            </Section>

            <Section title="Statistics">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <Metric label="Occupancy" value={`${propertyStats.occupied}/${propertyStats.capacity}`} />
                <Metric label="Vacant Beds" value={propertyStats.vacant} />
                <Metric label="Rent Collected" value={formatCurrency(propertyStats.rentCollection)} />
                <Metric label="Pending Rent" value={formatCurrency(propertyStats.pendingRent)} />
                <Metric label="Complaints" value={propertyStats.complaints} />
                <Metric label="Existing Imports" value={propertyStats.imports} />
                <Metric label="Applications" value={propertyStats.applications} />
                <Metric label="Room Changes" value={propertyStats.roomChanges} />
                <Metric label="Vacate Requests" value={propertyStats.vacates} />
                <Metric label="Notices" value={propertyStats.notices} />
              </div>
            </Section>

            <Section title="Rooms">
              <div className="space-y-3">
                {(selectedProperty.rooms || []).map(room => {
                  const roomTenants = propertyStats.tenants.filter(tenant => tenant.room_id === room.id)
                  const vacant = Math.max(0, Number(room.capacity || 0) - Number(room.current_occupants || 0))
                  return (
                    <div key={room.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">Room {room.room_number}</p>
                        <p className="text-sm text-slate-500">Capacity {room.capacity} - Occupied {room.current_occupants || 0} - Vacant {vacant} - {formatCurrency(room.monthly_rent)}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {roomTenants.length ? roomTenants.map(tenant => <button key={tenant.id} onClick={() => openTenantProfile(tenant)} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">{tenant.name}</button>) : <span className="text-sm text-slate-500">No current tenants</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>

            {propertyCollections && (
              <>
                <Section title="Applications">
                  <MiniList items={propertyCollections.applications.slice(0, 8)} emptyMessage="No applications found for this property." renderItem={item => <p key={item.id} className="rounded-lg bg-slate-50 p-2 text-sm">{item.full_name || item.name || item.email || 'Applicant'} - {item.status} - {formatDate(item.created_at)}</p>} />
                </Section>
                <Section title="Existing Tenant Imports">
                  <MiniList items={propertyCollections.imports.slice(0, 8)} emptyMessage="No existing tenant imports found for this property." renderItem={item => <p key={item.id} className="rounded-lg bg-slate-50 p-2 text-sm">{item.full_name} - {item.rooms?.room_number || item.room_number || 'Room N/A'} - {item.status}</p>} />
                </Section>
                <Section title="Payments">
                  <MiniList items={propertyCollections.payments.slice(0, 8)} emptyMessage="No payments found for this property." renderItem={item => <p key={item.id} className="rounded-lg bg-slate-50 p-2 text-sm">{item.tenants?.name || 'Tenant'} - {formatCurrency(item.amount)} - {item.status} - {formatDate(item.payment_date)}</p>} />
                </Section>
                <Section title="Complaints">
                  <MiniList items={propertyCollections.complaints.slice(0, 8)} emptyMessage="No complaints found for this property." renderItem={item => <p key={item.id} className="rounded-lg bg-slate-50 p-2 text-sm">{item.title || item.description || 'Complaint'} - {item.status} - {formatDate(item.created_at)}</p>} />
                </Section>
                <Section title="Notices">
                  <MiniList items={propertyCollections.notices.slice(0, 8)} emptyMessage="No notices found for this property." renderItem={item => <p key={item.id} className="rounded-lg bg-slate-50 p-2 text-sm">{item.title || 'Notice'} - {item.property_id ? 'Property' : 'Global'} - {formatDate(item.created_at)}</p>} />
                </Section>
                <Section title="Room Changes / Vacate Requests">
                  <div className="grid gap-3 md:grid-cols-2">
                    <MiniList items={propertyCollections.roomChanges.slice(0, 8)} emptyMessage="No room-change requests found." renderItem={item => <p key={item.id} className="rounded-lg bg-slate-50 p-2 text-sm">{item.tenants?.name || 'Tenant'} - {item.old_room?.room_number || 'N/A'} to {item.new_room?.room_number || 'N/A'} - {item.status}</p>} />
                    <MiniList items={propertyCollections.vacates.slice(0, 8)} emptyMessage="No vacate requests found." renderItem={item => <p key={item.id} className="rounded-lg bg-slate-50 p-2 text-sm">{item.tenants?.name || 'Tenant'} - {item.status} - {formatDate(item.expected_check_out || item.created_at)}</p>} />
                  </div>
                </Section>
              </>
            )}
          </section>
        )}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <Section title="Existing Tenant Imports">
          <div className="mb-3 flex flex-wrap gap-2">
            {['all', 'pending_owner_review', 'approved', 'rejected'].map(status => <button key={status} onClick={() => { setFilters(current => ({ ...current, importStatus: status })); setImportPage(0) }} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${filters.importStatus === status ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{status.replaceAll('_', ' ')}</button>)}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Tenant</th><th className="p-3">Property</th><th className="p-3">Room</th><th className="p-3">Rent</th><th className="p-3">Last paid rent due date</th><th className="p-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {pagedImports.map(item => (
                  <tr key={item.id}>
                    <td className="p-3"><p className="font-semibold">{item.full_name}</p><p className="text-xs text-slate-500">{item.phone} - {item.email}</p></td>
                    <td className="p-3">{item.properties?.name || 'N/A'}</td>
                    <td className="p-3">{item.rooms?.room_number || item.room_number}</td>
                    <td className="p-3">{formatCurrency(item.current_rent)}</td>
                    <td className="p-3">{formatDate(item.paid_through_date)}</td>
                    <td className="p-3">{statusPill(item.status)}</td>
                  </tr>
                ))}
                {!pagedImports.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No imports match the current filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button disabled={importPage === 0} onClick={() => setImportPage(page => Math.max(0, page - 1))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Previous</button>
            <span className="text-sm text-slate-500">Page {importPage + 1} of {Math.max(1, Math.ceil(filteredImports.length / PAGE_SIZE))}</span>
            <button disabled={(importPage + 1) * PAGE_SIZE >= filteredImports.length} onClick={() => setImportPage(page => page + 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Next</button>
          </div>
        </Section>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <Section title="Owner Management">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Owner</th><th className="p-3">Properties</th><th className="p-3">Tenants</th><th className="p-3">Payments</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.owners.filter(owner => matches(query, owner.full_name, owner.email, owner.phone)).map(owner => {
                  const ownerProperties = data.properties.filter(property => property.owner_id === owner.id)
                  const ownerTenants = data.tenants.filter(tenant => ownerProperties.some(property => property.id === tenant.property_id))
                  const ownerPayments = data.payments.filter(payment => ownerTenants.some(tenant => tenant.id === payment.tenant_id))
                  return <tr key={owner.id}><td className="p-3"><p className="font-semibold">{owner.full_name}</p><p className="text-xs text-slate-500">{owner.email}</p></td><td className="p-3">{ownerProperties.length}</td><td className="p-3">{ownerTenants.length}</td><td className="p-3">{formatCurrency(ownerPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0))}</td><td className="p-3">{statusPill(owner.is_active ? 'active' : 'suspended')}</td><td className="p-3"><button onClick={() => openOwnerProfile(owner)} className="rounded-lg border px-3 py-1.5 text-sm font-semibold hover:bg-slate-50">View</button></td></tr>
                })}
              </tbody>
            </table>
          </div>
        </Section>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <Section title="Enterprise Deletion Policy">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <p><strong>Normal admins:</strong> suspend or archive records. Permanent delete is intentionally not exposed here.</p>
            <p><strong>Super admin delete:</strong> requires explicit confirmation, typed entity name, transaction, dependent cleanup, storage cleanup, Auth user deletion, and audit log before execution.</p>
            <p><strong>Current console:</strong> Phase 1 is read-only visibility. Mutation controls remain outside this surface.</p>
            <p><strong>Future-ready:</strong> transfer ownership and hard-delete workflows should live behind server-only APIs with super-admin checks.</p>
          </div>
        </Section>
      </section>

      {selectedOwner && ownerProfile && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/60 p-4" onClick={() => { setSelectedOwner(null); setOwnerProfile(null) }}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-5" onClick={event => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-slate-900">{selectedOwner.full_name || 'Owner'}</h2><p className="text-sm text-slate-500">{selectedOwner.email || 'No email'} - {selectedOwner.phone || 'No phone'}</p></div>
              <button onClick={() => { setSelectedOwner(null); setOwnerProfile(null) }} className="text-2xl text-slate-400">x</button>
            </div>
            <div className="space-y-5">
              <Section title="Owner Details">
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <p><strong>Status:</strong> {selectedOwner.is_active ? 'Active' : 'Suspended'}</p>
                  <p><strong>Created:</strong> {formatDate(selectedOwner.created_at)}</p>
                  <p><strong>Properties:</strong> {ownerProfile.properties.length}</p>
                  <p><strong>Tenants:</strong> {ownerProfile.tenants.length}</p>
                  <p><strong>Revenue:</strong> {formatCurrency(ownerProfile.revenue)}</p>
                  <p><strong>Pending imports:</strong> {ownerProfile.imports.filter(item => item.status === 'pending_owner_review').length}</p>
                </div>
              </Section>
              <Section title="Properties / Memberships">
                <MiniList items={ownerProfile.properties} emptyMessage="No properties found for this owner." renderItem={property => (
                  <button key={property.id} onClick={() => { setSelectedPropertyId(property.id); setSelectedOwner(null); setOwnerProfile(null) }} className="block w-full rounded-lg bg-slate-50 p-3 text-left text-sm hover:bg-orange-50">
                    <span className="font-semibold">{property.name}</span> - {property.city || 'City N/A'} - {property.membership_active ? 'Membership active' : 'Membership inactive'}
                  </button>
                )} />
              </Section>
              <Section title="Summary">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric label="Applications" value={ownerProfile.applications.length} />
                  <Metric label="Existing Imports" value={ownerProfile.imports.length} />
                  <Metric label="Complaints" value={ownerProfile.complaints.length} />
                </div>
              </Section>
              <Section title="Tenants">
                <MiniList items={ownerProfile.tenants.slice(0, 12)} emptyMessage="No tenants found for this owner." renderItem={tenant => (
                  <button key={tenant.id} onClick={() => openTenantProfile(tenant)} className="block w-full rounded-lg bg-slate-50 p-3 text-left text-sm hover:bg-blue-50">
                    <span className="font-semibold">{tenant.name}</span> - {tenant.property?.name || 'Property N/A'} - Room {tenant.rooms?.room_number || 'N/A'}
                  </button>
                )} />
              </Section>
            </div>
          </div>
        </div>
      )}

      {selectedTenant && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedTenant(null)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-5" onClick={event => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-slate-900">{selectedTenant.name}</h2><p className="text-sm text-slate-500">{selectedTenant.email} - {selectedTenant.phone}</p></div>
              <button onClick={() => setSelectedTenant(null)} className="text-2xl text-slate-400">x</button>
            </div>
            {tenantLoading ? <p className="py-8 text-center text-slate-500">Loading tenant profile...</p> : tenantProfile && (
              <div className="space-y-5">
                <Section title="Personal / Room / Rent"><div className="grid gap-2 text-sm sm:grid-cols-3"><p><strong>Room:</strong> {selectedTenant.rooms?.room_number || 'N/A'}</p><p><strong>Rent:</strong> {formatCurrency(selectedTenant.rent_amount)}</p><p><strong>Status:</strong> {selectedTenant.status}</p><p><strong>Rent status:</strong> {selectedTenant.rent_status}</p><p><strong>Move-in:</strong> {formatDate(selectedTenant.move_in_date)}</p><p><strong>Realtime:</strong> Live dashboard updates enabled</p></div></Section>
                <Section title="Documents"><DocumentGrid documents={tenantProfile.documents} onOpen={openTenantDocument} /></Section>
                <Section title="Payments"><div className="space-y-2">{tenantProfile.payments.length ? tenantProfile.payments.map(payment => <p key={payment.id} className="rounded-lg bg-slate-50 p-2 text-sm">{formatDate(payment.payment_date)} - {formatCurrency(payment.amount)} - {payment.status}</p>) : <p className="text-sm text-slate-500">No payments found.</p>}</div></Section>
                <Section title="Complaints"><div className="space-y-2">{tenantProfile.complaints.length ? tenantProfile.complaints.map(item => <p key={item.id} className="rounded-lg bg-slate-50 p-2 text-sm">{item.title} - {item.status}</p>) : <p className="text-sm text-slate-500">No complaints found.</p>}</div></Section>
                <Section title="Room Changes / Vacate History"><div className="grid gap-3 md:grid-cols-2"><div>{tenantProfile.roomChanges.length ? tenantProfile.roomChanges.map(item => <p key={item.id} className="rounded-lg bg-slate-50 p-2 text-sm">{item.old_room?.room_number} to {item.new_room?.room_number} - {item.status}</p>) : <p className="text-sm text-slate-500">No room changes.</p>}</div><div>{tenantProfile.vacates.length ? tenantProfile.vacates.map(item => <p key={item.id} className="rounded-lg bg-slate-50 p-2 text-sm">{formatDate(item.expected_check_out)} - {item.status}</p>) : <p className="text-sm text-slate-500">No vacate history.</p>}</div></div></Section>
                <Section title="Import / Application History"><div className="grid gap-3 md:grid-cols-2"><div>{tenantProfile.imports.length ? tenantProfile.imports.map(item => <p key={item.id} className="rounded-lg bg-slate-50 p-2 text-sm">{item.status} - {formatDate(item.created_at)}</p>) : <p className="text-sm text-slate-500">No import history.</p>}</div><div>{tenantProfile.applications.length ? tenantProfile.applications.map(item => <p key={item.id} className="rounded-lg bg-slate-50 p-2 text-sm">{item.status} - {formatDate(item.created_at)}</p>) : <p className="text-sm text-slate-500">No application history.</p>}</div></div></Section>
              </div>
            )}
          </div>
        </div>
      )}

      {screenshotUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" onClick={() => setScreenshotUrl('')}>
          <div className="max-h-[90vh] max-w-4xl overflow-auto rounded-xl bg-white p-4" onClick={event => event.stopPropagation()}>
            <button onClick={() => setScreenshotUrl('')} className="mb-3 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">Close</button>
            <img src={screenshotUrl} alt="Secure document" className="max-h-[80vh] max-w-full object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}
