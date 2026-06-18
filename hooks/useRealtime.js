import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Subscribe to real‑time changes on a table and call a callback when data changes.
 * @param {string} table - Table name (e.g., 'tenants', 'payment_history')
 * @param {function} onUpdate - Callback function that receives the payload (new/old record)
 * @param {object} filter - Optional filter object like { column: 'property_id', value: 'some-uuid' }
 */
export function useRealtime(table, onUpdate, filter = null) {
  const subscriptionRef = useRef(null)

  useEffect(() => {
    if (!onUpdate) return

    const channelName = `realtime:${table}`
    const channel = supabase.channel(channelName)

    // Build filter string for Supabase
    let filterString = null
    if (filter && filter.column && filter.value) {
      filterString = `${filter.column}=eq.${filter.value}`
    }

    // Subscribe to changes
    channel
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events
          schema: 'public',
          table: table,
          filter: filterString,
        },
        (payload) => {
          onUpdate(payload)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to ${table} changes${filterString ? ' (filtered)' : ''}`)
        }
      })

    return () => {
      supabase.removeChannel(channel)
      console.log(`🔄 Unsubscribed from ${table}`)
    }
  }, [table, filter?.column, filter?.value, onUpdate])
}
