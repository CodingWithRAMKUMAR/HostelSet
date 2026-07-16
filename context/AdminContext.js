import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { clearHostelSetSessionCache, getRestoredSession, supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

const AdminContext = createContext();

const emptyAdminStats = {
  totalProperties: 0,
  totalTenants: 0,
  totalOwners: 0,
  activeOwners: 0,
  activeMemberships: 0,
  totalRevenue: 0,
  totalDeposits: 0,
  pendingComplaints: 0,
  pendingVacates: 0,
};

const markAdminPerf = (label, detail = '', startedAt = null) => {
  if (typeof window === 'undefined' || window.localStorage?.getItem('hostelsetAdminPerf') !== '1' || typeof performance === 'undefined') return;
  const elapsed = typeof startedAt === 'number' ? ` ${Math.round(performance.now() - startedAt)}ms` : '';
  console.info(`[AdminData] ${label}${elapsed}${detail ? ` ${detail}` : ''}`);
};

export function AdminProvider({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [admin, setAdmin] = useState(null);
  const [globalStats, setGlobalStats] = useState(emptyAdminStats);
  const inFlightStatsRef = useRef(null);
  const lastLoadedKeyRef = useRef(null);
  const lastLoadedResultRef = useRef(null);
  const adminRef = useRef(null);

  useEffect(() => { adminRef.current = admin; }, [admin]);

  const checkAuthAndRedirect = async () => {
    const { data: { session }, error } = await getRestoredSession();
    const user = session?.user;
    if (error || !user) { router.replace('/login/admin'); return null; }
    const { data: userRecord, error: roleError } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (roleError || !userRecord || userRecord.role !== 'admin') {
      toast.error('Access Denied: Admins only.');
      router.replace(`/login/${userRecord?.role || 'admin'}`); return null;
    }
    return { user, role: userRecord.role };
  };

  const loadGlobalStats = useCallback(async (backgroundOrOptions = false) => {
    const options = typeof backgroundOrOptions === 'object'
      ? backgroundOrOptions
      : { background: Boolean(backgroundOrOptions) };
    const background = Boolean(options.background);
    const force = Boolean(options.force ?? background);
    const reason = options.reason || (background ? 'background-refresh' : 'initial-admin-load');
    const adminId = adminRef.current?.id || options.adminId || 'pending-admin';
    const loadKey = String(adminId);
    markAdminPerf('load-requested', `reason=${reason} key=${loadKey}${force ? ' force=true' : ''}`);

    if (inFlightStatsRef.current?.key === loadKey) {
      markAdminPerf('load-joined-in-flight', `reason=${reason} key=${loadKey}`);
      return inFlightStatsRef.current.promise;
    }

    if (!force && lastLoadedResultRef.current && lastLoadedKeyRef.current === loadKey) {
      markAdminPerf('load-skipped-cached', `reason=${reason} key=${loadKey}`);
      return lastLoadedResultRef.current;
    }

    const runLoad = async () => {
    const startedAt = typeof performance !== 'undefined' ? performance.now() : null;
    markAdminPerf(background ? 'background-refresh-network-start' : 'core-load-start', `reason=${reason} key=${loadKey}`);
    if (!background) setStatsLoading(true);
    try {
      const { data: aggregateStats, error: aggregateError } = await supabase.rpc('get_admin_dashboard_stats');
      if (!aggregateError && aggregateStats) {
        const nextStats = {
          totalProperties: Number(aggregateStats.totalProperties || 0),
          totalTenants: Number(aggregateStats.totalTenants || 0),
          totalOwners: Number(aggregateStats.totalOwners || 0),
          activeOwners: Number(aggregateStats.activeOwners || 0),
          activeMemberships: Number(aggregateStats.activeMemberships || 0),
          totalRevenue: Number(aggregateStats.totalRevenue || 0),
          totalDeposits: Number(aggregateStats.totalDeposits || 0),
          pendingComplaints: Number(aggregateStats.pendingComplaints || 0),
          pendingVacates: Number(aggregateStats.pendingVacates || 0),
        };
        setGlobalStats(nextStats);
        lastLoadedKeyRef.current = loadKey;
        lastLoadedResultRef.current = nextStats;
        markAdminPerf(background ? 'background-refresh-finish' : 'core-load-finish', `reason=${reason} key=${loadKey}`, startedAt);
        return nextStats;
      }

      // Safe rollout fallback while the performance migration is being applied.
      const [{ count: propCount }, { count: tenantCount }, { count: ownerCount }, { count: activeOwnerCount }, { count: activeMembershipCount }, { data: payments }, { count: complaintCount }, { count: vacateCount }] = await Promise.all([
        supabase.from('properties').select('*', { count: 'exact', head: true }),
        supabase.from('tenants').select('*', { count: 'exact', head: true }).in('status', ['active', 'notice_period', 'payment_pending']),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'owner'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'owner').eq('is_active', true),
        supabase.from('properties').select('*', { count: 'exact', head: true }).eq('membership_active', true).gt('membership_expiry', new Date().toISOString()),
        supabase.from('payment_history').select('amount,payment_method').eq('status', 'success'),
        supabase.from('complaints').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
        supabase.from('check_out_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      const totalRevenue = payments?.filter(payment => payment.payment_method !== 'security_deposit').reduce((sum, payment) => sum + Number(payment.amount || 0), 0) || 0;
      const totalDeposits = payments?.filter(payment => payment.payment_method === 'security_deposit').reduce((sum, payment) => sum + Number(payment.amount || 0), 0) || 0;
      
      const nextStats = {
        totalProperties: propCount || 0,
        totalTenants: tenantCount || 0,
        totalOwners: ownerCount || 0,
        activeOwners: activeOwnerCount || 0,
        activeMemberships: activeMembershipCount || 0,
        totalRevenue,
        totalDeposits,
        pendingComplaints: complaintCount || 0,
        pendingVacates: vacateCount || 0,
      };
      setGlobalStats(nextStats);
      lastLoadedKeyRef.current = loadKey;
      lastLoadedResultRef.current = nextStats;
      markAdminPerf(background ? 'background-refresh-finish' : 'core-load-finish', `reason=${reason} key=${loadKey}`, startedAt);
      return nextStats;
    } catch (error) {
      console.error('Failed to load global stats:', error);
      if (!background) toast.error('Failed to load dashboard totals');
      return lastLoadedResultRef.current || false;
    } finally {
      setStatsLoading(false);
    }
    };

    const promise = runLoad();
    inFlightStatsRef.current = { key: loadKey, promise };
    try {
      return await promise;
    } finally {
      if (inFlightStatsRef.current?.promise === promise) inFlightStatsRef.current = null;
    }
  }, []);

  const realtimeConnected = useRealtimeRefresh(
    'admin-global-stats-live',
    ['users', 'properties', 'tenants', 'payment_history', 'complaints', 'check_out_requests'],
    loadGlobalStats,
    Boolean(admin),
    350,
  );

  useEffect(() => {
    const init = async () => {
      const auth = await checkAuthAndRedirect();
      if (!auth) return;
      setAdmin(auth.user);
      localStorage.setItem('userId', auth.user.id);
      setLoading(false);
      loadGlobalStats({ reason: 'initial-admin-load', adminId: auth.user.id });
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearHostelSetSessionCache();
        inFlightStatsRef.current = null;
        lastLoadedKeyRef.current = null;
        lastLoadedResultRef.current = null;
        setAdmin(null);
        setGlobalStats(emptyAdminStats);
        router.replace('/login/admin');
      }
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  return (
    <AdminContext.Provider value={{ loading, statsLoading, realtimeConnected, admin, globalStats, refreshStats: loadGlobalStats }}>
      {loading ? (
        <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-sm font-medium text-gray-500">Opening admin control center…</p>
          </div>
        </div>
      ) : children}
    </AdminContext.Provider>
  );
}
export const useAdmin = () => useContext(AdminContext);
