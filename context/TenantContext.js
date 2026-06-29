import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const TenantContext = createContext();

export function TenantProvider({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState(null);
  const [room, setRoom] = useState(null);
  const [property, setProperty] = useState(null);
  const [owner, setOwner] = useState(null);
  const [roommates, setRoommates] = useState([]);
  const [roommateVacateAlert, setRoommateVacateAlert] = useState(null);
  const [error, setError] = useState(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const userIdRef = useRef(null);

  const refreshData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);

    try {
      let userId = userIdRef.current;
      if (!isBackground || !userId) {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        const user = session?.user;
        if (authError || !user) {
          localStorage.clear();
          await router.push('/login');
          return false;
        }

        const { data: userRecord, error: roleError } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();

        if (roleError || userRecord?.role !== 'tenant') {
          toast.error('Access denied. You are not registered as a tenant.');
          await router.push('/login');
          return false;
        }
        userId = user.id;
        userIdRef.current = user.id;
      }

      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*, rooms:room_id(*), property:property_id(*)')
        .eq('user_id', userId)
        .maybeSingle();

      if (tenantError) throw tenantError;
      if (!tenantData) {
        setTenant(null);
        setRoom(null);
        setProperty(null);
        setOwner(null);
        setRoommates([]);
        setRoommateVacateAlert(null);
        setError('No tenant record found in the database.');
        return false;
      }

      const [ownerResult, roommatesResult] = await Promise.all([
        tenantData.property?.owner_id
          ? supabase.from('users').select('full_name, phone, email').eq('id', tenantData.property.owner_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        tenantData.room_id
          ? supabase
              .from('tenants')
              .select('id, name, phone, email, status, room_id, move_in_date')
              .eq('room_id', tenantData.room_id)
              .neq('id', tenantData.id)
              .in('status', ['active', 'notice_period', 'payment_pending'])
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (ownerResult.error) throw ownerResult.error;
      if (roommatesResult.error) throw roommatesResult.error;

      const roommateRows = roommatesResult.data || [];
      let vacateAlert = null;
      const roommateIds = roommateRows.map((roommate) => roommate.id);
      if (roommateIds.length) {
        const { data: vacateRequests, error: vacateError } = await supabase
          .from('check_out_requests')
          .select('id, tenant_id, tenant_name, expected_check_out, status')
          .in('tenant_id', roommateIds)
          .in('status', ['pending', 'approved'])
          .order('created_at', { ascending: false })
          .limit(1);
        if (vacateError) throw vacateError;
        const request = vacateRequests?.[0];
        if (request) {
          const vacateDate = new Date(request.expected_check_out);
          const daysLeft = Math.max(0, Math.ceil((vacateDate - new Date()) / (1000 * 60 * 60 * 24)));
          vacateAlert = {
            ...request,
            name: request.tenant_name || roommateRows.find((mate) => mate.id === request.tenant_id)?.name || 'A roommate',
            date: request.expected_check_out,
            daysLeft,
          };
        }
      }

      setTenant(tenantData);
      setRoom(tenantData.rooms || null);
      setProperty(tenantData.property || null);
      setOwner(ownerResult.data || null);
      setRoommates(roommateRows);
      setRoommateVacateAlert(vacateAlert);
      setError(null);
      return true;
    } catch (loadError) {
      console.error('Failed to load tenant dashboard:', loadError);
      setError(loadError.message);
      if (!isBackground) toast.error('Failed to load dashboard: ' + loadError.message);
      return false;
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    refreshData(false);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.clear();
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshData, router]);

  useEffect(() => {
    if (!tenant?.id || !room?.id || !property?.id) return undefined;

    let timer;
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => refreshData(true), 200);
    };
    let channel = supabase
      .channel(`tenant-dashboard-live:${tenant.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants', filter: `user_id=eq.${tenant.user_id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants', filter: `room_id=eq.${room.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties', filter: `id=eq.${property.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'check_out_requests', filter: `room_id=eq.${room.id}` }, scheduleRefresh);

    if (property.owner_id) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${property.owner_id}` }, scheduleRefresh);
    }

    channel.subscribe((status) => setRealtimeConnected(status === 'SUBSCRIBED'));
    return () => {
      clearTimeout(timer);
      setRealtimeConnected(false);
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, tenant?.user_id, room?.id, property?.id, property?.owner_id, refreshData]);

  return (
    <TenantContext.Provider value={{
      loading,
      tenant,
      setTenant,
      room,
      property,
      owner,
      roommates,
      roommateVacateAlert,
      error,
      realtimeConnected,
      refreshData,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);
