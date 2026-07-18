import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useRealtimeRefresh } from './useRealtimeRefresh'

const emptyCounts = {
  pendingMemberships: 0,
  pendingApplications: 0,
  openComplaints: 0,
  pendingVacates: 0,
  pendingRoomChanges: 0,
  paymentIssues: 0,
  notices: 0,
}

const emptySnapshot = {
  snapshotVersion: 1,
  counts: emptyCounts,
  membershipRequests: [],
  applications: [],
  complaints: [],
  vacateRequests: [],
  roomChanges: [],
  notices: [],
}

const toCount = value => Number.isFinite(Number(value)) ? Number(value) : 0

const normalizeSnapshot = data => ({
  snapshotVersion: Number(data?.snapshot_version || 1),
  counts: {
    pendingMemberships: toCount(data?.counts?.pending_memberships),
    pendingApplications: toCount(data?.counts?.pending_applications),
    openComplaints: toCount(data?.counts?.open_complaints),
    pendingVacates: toCount(data?.counts?.pending_vacates),
    pendingRoomChanges: toCount(data?.counts?.pending_room_changes),
    paymentIssues: toCount(data?.counts?.payment_issues),
    notices: toCount(data?.counts?.notices),
  },
  membershipRequests: Array.isArray(data?.membership_requests) ? data.membership_requests : [],
  applications: Array.isArray(data?.applications) ? data.applications : [],
  complaints: Array.isArray(data?.complaints) ? data.complaints : [],
  vacateRequests: Array.isArray(data?.vacate_requests) ? data.vacate_requests : [],
  roomChanges: Array.isArray(data?.room_changes) ? data.room_changes : [],
  notices: Array.isArray(data?.notices) ? data.notices : [],
})

export function useAdminOverviewSnapshot(enabled = true) {
  const [snapshot, setSnapshot] = useState(emptySnapshot)
  const [loading, setLoading] = useState(true)

  const loadSnapshot = useCallback(async (backgroundOrOptions = false) => {
    if (!enabled) return false
    const background = typeof backgroundOrOptions === 'object'
      ? Boolean(backgroundOrOptions.background)
      : Boolean(backgroundOrOptions)
    if (!background) setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_admin_dashboard_overview_snapshot')
      if (error) throw error
      const normalized = normalizeSnapshot(data)
      setSnapshot(normalized)
      return normalized
    } catch (error) {
      console.error('Admin overview snapshot load failed:', error)
      if (!background) toast.error('Failed to load admin action center')
      return false
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (enabled) loadSnapshot(false)
  }, [enabled, loadSnapshot])

  useRealtimeRefresh(
    'admin-overview-snapshot-live',
    ['membership_requests', 'applications', 'complaints', 'check_out_requests', 'room_change_requests', 'payment_history', 'notices'],
    loadSnapshot,
    enabled,
    500,
  )

  return { snapshot, loading, refreshSnapshot: loadSnapshot }
}
