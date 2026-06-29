import { createContext, useCallback, useContext, useEffect, useState } from 'react';
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

  const refreshData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
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

      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*, rooms:room_id(*), property:property_id(*)')
        .eq('user_id', user.id)
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
      refreshData,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);
