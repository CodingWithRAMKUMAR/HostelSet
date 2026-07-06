import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { signPrivateDocumentFields, supabase } from '../lib/supabase'

const PAGE_SIZE = 20

export function useExistingTenantImports(property, listEnabled = false, onApproved) {
  const [link, setLink] = useState(null)
  const [imports, setImports] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState(null)
  const [linkBusy, setLinkBusy] = useState(false)
  const timer = useRef()

  const loadSummary = useCallback(async () => {
    if (!property?.id) return
    const [linkResult, countResult] = await Promise.all([
      supabase.from('existing_tenant_import_links').select('*').eq('property_id', property.id).maybeSingle(),
      supabase.from('existing_tenant_imports').select('id', { count: 'exact', head: true }).eq('property_id', property.id).eq('status', 'pending_owner_review').is('deleted_at', null),
    ])
    if (linkResult.error) throw linkResult.error
    if (countResult.error) throw countResult.error
    setLink(linkResult.data || null); setPendingCount(countResult.count || 0)
  }, [property?.id])

  const loadImports = useCallback(async (targetPage = page) => {
    if (!property?.id || !listEnabled) return
    setLoading(true)
    try {
      const from = targetPage * PAGE_SIZE
      const { data, error, count } = await supabase.from('existing_tenant_imports').select('*,rooms(room_number)', { count: 'exact' })
        .eq('property_id', property.id).is('deleted_at', null).order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      const signed = await Promise.all((data || []).map(item => signPrivateDocumentFields(item, ['id_proof', 'profile_photo'])))
      setImports(signed); setTotal(count || 0); setPage(targetPage)
    } catch (error) { toast.error(`Unable to load imports: ${error.message}`) }
    finally { setLoading(false) }
  }, [property?.id, listEnabled, page])

  const refresh = useCallback(async () => { await loadSummary(); if (listEnabled) await loadImports(page) }, [loadSummary, loadImports, listEnabled, page])
  const rotateLink = async () => {
    if (linkBusy) return
    setLinkBusy(true)
    try {
      const { data, error } = await supabase.rpc('rotate_existing_tenant_import_link', { p_property_id: property.id })
      if (error) throw error
      setLink(current => ({ ...(current || {}), property_id: property.id, token: data, is_active: true })); toast.success('Import link generated')
    } catch (error) { toast.error(error.message) }
    finally { setLinkBusy(false) }
  }
  const setLinkEnabled = async enabled => {
    if (linkBusy) return
    setLinkBusy(true)
    try {
      const { error } = await supabase.rpc('set_existing_tenant_import_link_enabled', { p_property_id: property.id, p_enabled: enabled })
      if (error) throw error
      setLink(current => ({ ...current, is_active: enabled })); toast.success(enabled ? 'Import link enabled' : 'Import link disabled')
    } catch (error) { toast.error(error.message) }
    finally { setLinkBusy(false) }
  }
  const approve = async id => {
    if (processingId) return
    setProcessingId(id)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('Session expired. Please log in again.')
      const response = await fetch('/api/owner/approve-existing-import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId: id }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Import approval failed')
      toast.success(result.inviteEmailSent ? 'Existing tenant approved and invite sent' : 'Existing tenant approved')
      await refresh(); await onApproved?.()
    } catch (error) { toast.error(error.message) }
    finally { setProcessingId(null) }
  }
  const reject = async (id, reason) => {
    if (processingId) return
    setProcessingId(id)
    try {
      const { error } = await supabase.rpc('reject_existing_tenant_import', { p_import_id: id, p_reason: reason || null })
      if (error) throw error
      toast.success('Import submission rejected'); await refresh()
    } catch (error) { toast.error(error.message) }
    finally { setProcessingId(null) }
  }

  useEffect(() => { loadSummary().catch(error => toast.error(error.message)) }, [loadSummary])
  useEffect(() => { setImports([]); setTotal(0); setPage(0); if (listEnabled) loadImports(0) }, [property?.id, listEnabled])
  useEffect(() => {
    if (!property?.id) return undefined
    const channel = supabase.channel(`existing-imports:${property.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'existing_tenant_imports', filter: `property_id=eq.${property.id}` }, () => {
      clearTimeout(timer.current); timer.current = setTimeout(refresh, 250)
    }).subscribe()
    return () => { clearTimeout(timer.current); supabase.removeChannel(channel) }
  }, [property?.id, refresh])

  return { link, linkBusy, imports, pendingCount, total, page, pageSize: PAGE_SIZE, loading, processingId, rotateLink, setLinkEnabled, approve, reject, loadPage: loadImports }
}
