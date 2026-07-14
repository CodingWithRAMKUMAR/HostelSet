import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { clearHostelSetSessionCache, getRestoredSession, supabase, syncServerSession } from '../lib/supabase';
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
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);
  const [roommateVacateAlert, setRoommateVacateAlert] = useState(null);
  const [error, setError] = useState(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const userIdRef = useRef(null);
  const profilePhotoCacheRef = useRef(new Map());

  const loadTenantProfilePhoto = useCallback(async (tenantData) => {
    if (!tenantData?.id || !tenantData?.property_id) {
      setProfilePhotoUrl(null);
      return null;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const userScope = session?.user?.id || 'anonymous';
    const cacheKey = `${userScope}:${tenantData.id}:${tenantData.property_id}:${tenantData.profile_photo_path || ''}:${tenantData.updated_at || tenantData.move_in_date || ''}`;
    if (profilePhotoCacheRef.current.has(cacheKey)) {
      const cachedUrl = profilePhotoCacheRef.current.get(cacheKey);
      setProfilePhotoUrl(cachedUrl);
      return cachedUrl;
    }

    try {
      const response = await fetch('/api/tenant/profile-photo-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({}),
      });
      if (response.status === 404) {
        profilePhotoCacheRef.current.set(cacheKey, null);
        setProfilePhotoUrl(null);
        return null;
      }
      if (!response.ok) throw new Error('Profile photo unavailable');
      const data = await response.json();
      const url = data?.signedUrl || null;
      profilePhotoCacheRef.current.set(cacheKey, url);
      setProfilePhotoUrl(url);
      return url;
    } catch (photoError) {
      if (process.env.NODE_ENV !== 'production') console.warn('[HostelSet] Tenant profile photo could not be loaded.');
      setProfilePhotoUrl(null);
      return null;
    }
  }, []);

  const refreshData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);

    try {
      let userId = userIdRef.current;
      let shouldCheckRole = false;
      if (!isBackground || !userId) {
        const { data: { session }, error: authError } = await getRestoredSession();
        const user = session?.user;
        if (authError || !user) {
          await router.replace('/login/tenant');
          return false;
        }

        userId = user.id;
        userIdRef.current = user.id;
        shouldCheckRole = true;
      }

      const [roleResult, tenantResult] = await Promise.all([
        shouldCheckRole
          ? supabase.from('users').select('role').eq('id', userId).single()
          : Promise.resolve({ data: { role: 'tenant' }, error: null }),
        supabase
          .from('tenants')
          .select('*, rooms:room_id(*), property:property_id(*)')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      if (roleResult.error || roleResult.data?.role !== 'tenant') {
        toast.error('Access denied. You are not registered as a tenant.');
        await router.replace(`/login/${roleResult.data?.role || 'tenant'}`);
        return false;
      }

      const { data: tenantData, error: tenantError } = tenantResult;

      if (tenantError) throw tenantError;
      if (!tenantData) {
        setTenant(null);
        setRoom(null);
        setProperty(null);
        setOwner(null);
        setRoommates([]);
        setProfilePhotoUrl(null);
        setRoommateVacateAlert(null);
        setError('No tenant record found in the database.');
        return false;
      }

      // Render the usable dashboard as soon as the tenant, room and property
      // arrive. Owner/roommate details continue loading in parallel below.
      setTenant(tenantData);
      setRoom(tenantData.rooms || null);
      setProperty(tenantData.property || null);
      setError(null);
      loadTenantProfilePhoto(tenantData);
      if (!isBackground) setLoading(false);

      const [ownerResult, roommatesResult] = await Promise.all([
        tenantData.property?.owner_id
          ? supabase.from('users').select('full_name, phone, email').eq('id', tenantData.property.owner_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        tenantData.room_id
          ? supabase.rpc('get_my_roommate_contacts')
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
  }, [loadTenantProfilePhoto, router]);

  useEffect(() => {
    refreshData(false);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearHostelSetSessionCache();
        profilePhotoCacheRef.current.clear();
        setProfilePhotoUrl(null);
        router.replace('/login/tenant');
      } else if (event === 'TOKEN_REFRESHED' && session) {
        syncServerSession(session).catch((sessionError) => console.error('Unable to refresh server session:', sessionError));
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshData, router]);

  useEffect(() => {
    if (!tenant?.id || !room?.id || !property?.id) return undefined;

    let timer;
    let active = true;
    setRealtimeConnected(false);
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

    channel.subscribe((status) => { if (active) setRealtimeConnected(status === 'SUBSCRIBED'); });
    return () => {
      active = false;
      clearTimeout(timer);
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
      profilePhotoUrl,
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
