import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useOwnerAnalytics(property, enabled = true) {
  const [applications, setApplications] = useState([])
  const [imports, setImports] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!property?.id || !enabled) return
    let active = true
    const load = async () => {
      setLoading(true)
      const [applicationResult, importResult] = await Promise.all([
        supabase.from('applications')
          .select('id, property_id, status, created_at')
          .eq('property_id', property.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase.from('existing_tenant_imports')
          .select('id, property_id, status, created_at')
          .eq('property_id', property.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1000),
      ])
      if (!active) return
      setApplications(applicationResult.error ? [] : applicationResult.data || [])
      setImports(importResult.error ? [] : importResult.data || [])
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [property?.id, enabled])

  return useMemo(() => ({ applications, imports, loading }), [applications, imports, loading])
}
