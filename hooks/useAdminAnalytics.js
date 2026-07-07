import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const LIMIT = 1500

export function useAdminAnalytics(enabled = true) {
  const [data, setData] = useState({
    properties: [],
    rooms: [],
    tenants: [],
    payments: [],
    applications: [],
    imports: [],
    complaints: [],
    vacates: [],
    roomChanges: [],
    owners: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled) return
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      const queries = await Promise.all([
        supabase.from('properties').select('id, name, owner_id, is_active, created_at').order('created_at', { ascending: false }).limit(LIMIT),
        supabase.from('rooms').select('id, property_id, capacity, current_occupants').limit(LIMIT),
        supabase.from('tenants').select('id, property_id, status, pending_amount, created_at').order('created_at', { ascending: false }).limit(LIMIT),
        supabase.from('payment_history').select('id, tenant_id, amount, status, payment_method, payment_date, created_at, tenants(property_id, properties(name))').order('payment_date', { ascending: false }).limit(LIMIT),
        supabase.from('applications').select('id, property_id, status, created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(LIMIT),
        supabase.from('existing_tenant_imports').select('id, property_id, status, created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(LIMIT),
        supabase.from('complaints').select('id, property_id, status, created_at').order('created_at', { ascending: false }).limit(LIMIT),
        supabase.from('check_out_requests').select('id, property_id, status, created_at').order('created_at', { ascending: false }).limit(LIMIT),
        supabase.from('room_change_requests').select('id, property_id, status, created_at, requested_at').order('created_at', { ascending: false }).limit(LIMIT),
        supabase.from('users').select('id, role, is_active, created_at').eq('role', 'owner').order('created_at', { ascending: false }).limit(LIMIT),
      ])
      if (!active) return
      const failed = queries.find(result => result.error)
      if (failed) {
        setError(failed.error.message)
      } else {
        setData({
          properties: queries[0].data || [],
          rooms: queries[1].data || [],
          tenants: queries[2].data || [],
          payments: queries[3].data || [],
          applications: queries[4].data || [],
          imports: queries[5].data || [],
          complaints: queries[6].data || [],
          vacates: queries[7].data || [],
          roomChanges: queries[8].data || [],
          owners: queries[9].data || [],
        })
      }
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [enabled])

  return useMemo(() => ({ ...data, loading, error }), [data, loading, error])
}
