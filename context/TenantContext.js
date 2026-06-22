import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { calculateRentDueStatus } from '../lib/utils';
import toast from 'react-hot-toast';

const TenantContext = createContext();

export function TenantProvider({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tenant, setTenant] = useState(null);
  const [room, setRoom] = useState(null);
  const [property, setProperty] = useState(null);
  const [owner, setOwner] = useState(null);
  const [roommates, setRoommates] = useState([]);

  const loadTenantData = useCallback(async (userId, isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setIsRefreshing(true);

    try {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('*, rooms:room_id(*), property:property_id(*)')
        .eq('user_id', userId)
        .maybeSingle();

      if (!tenantData) {
        toast.error('No tenant record found');
        router.push('/login');
        return;
      }

      setTenant(tenantData);
      setRoom(tenantData.rooms);
      setProperty(tenantData.property);

      if (tenantData.property?.owner_id) {
        const { data: settings } = await supabase
          .from('owner_settings')
          .select('upi_id, upi_phone')
          .eq('owner_id', tenantData.property.owner_id)
          .maybeSingle();

        const { data: ownerData } = await supabase
          .from('users')
          .select('full_name, phone, email')
          .eq('id', tenantData.property.owner_id)
          .single();
        setOwner(ownerData);
      }

      // Load Roommates
      let roommatesList = [];
      if (tenantData.room_id) {
        const { data: roommatesData } = await supabase
          .from('tenants')
          .select('name, phone, email, move_in_date, id')
          .eq('room_id', tenantData.room_id)
          .neq('id', tenantData.id);
        roommatesList = roommatesData || [];
        setRoommates(roommatesList);
      }
    } catch (error) {
      console.error('Load tenant core data error:', error);
      toast.error('Failed to load core dashboard data');
    } finally {
      if (!isBackground) setLoading(false);
      else setIsRefreshing(false);
    }
  }, []);

  const refreshData = useCallback((isBackground = true) => {
    const userId = localStorage.getItem('userId');
    if (userId) loadTenantData(userId, isBackground);
  }, [loadTenantData]);

  const checkAuthAndRedirect = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      localStorage.clear();
      router.push('/login');
      return null;
    }
    const { data: userRecord, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (roleError || !userRecord) {
      localStorage.clear();
      router.push('/login');
      return null;
    }
    return { user, role: userRecord.role };
  };

  useEffect(() => {
    const init = async () => {
      const auth = await checkAuthAndRedirect();
      if (!auth) return;
      if (auth.role !== 'tenant') {
        router.push('/login');
        return;
      }
      localStorage.setItem('userId', auth.user.id);
      await loadTenantData(auth.user.id, false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.clear();
        router.push('/login');
      }
    });
    return () => { if (subscription) subscription.unsubscribe(); };
  }, []);

  return (
    <TenantContext.Provider value={{
      loading, isRefreshing, tenant, room, property, owner, roommates,
      refreshData, setTenant
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);
