import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
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
  const [roommateVacateAlert, setRoommateVacateAlert] = useState(null);

  const loadTenantData = useCallback(async (userId, isBackground = false) => {
    if (!isBackground) setLoading(true); else setIsRefreshing(true);

    try {
      console.log("🔍 DEBUG: Attempting to fetch tenant data for user ID:", userId);

      const { data: tenantData, error } = await supabase
        .from('tenants')
        .select('*, rooms:room_id(*), property:property_id(*)')
        .eq('user_id', userId)
        .maybeSingle();

      console.log("🔍 DEBUG: Supabase Raw Response:", { tenantData, error });

      if (error) {
        console.error('Supabase Error:', error);
        toast.error('Failed to load tenant data: ' + error.message);
        if (!isBackground) setLoading(false);
        return;
      }

      if (!tenantData) {
        console.warn("⚠️ DEBUG: No tenant data found for this user.");
        toast.error('No tenant record found. Please ensure you are logged in as a valid tenant.');
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

      let roommatesList = [];
      if (tenantData.room_id) {
        const { data: roommatesData } = await supabase
          .from('tenants')
          .select('name, phone, email, move_in_date, id')
          .eq('room_id', tenantData.room_id)
          .neq('id', tenantData.id);
        roommatesList = roommatesData || []; 
        setRoommates(roommatesList);
        
        if (roommatesList.length > 0) {
          const roommateIds = roommatesList.map(r => r.id);
          const { data: vacateRequests } = await supabase
            .from('check_out_requests')
            .select('tenant_id, tenant_name, expected_check_out')
            .in('tenant_id', roommateIds)
            .eq('status', 'approved');
          const upcoming = vacateRequests?.find(v => new Date(v.expected_check_out) > new Date());
          if (upcoming) {
            const roommate = roommatesList.find(r => r.id === upcoming.tenant_id);
            setRoommateVacateAlert({ 
              name: roommate?.name || upcoming.tenant_name, 
              daysLeft: Math.ceil((new Date(upcoming.expected_check_out) - new Date()) / (1000 * 60 * 60 * 24)), 
              date: upcoming.expected_check_out 
            });
          }
        }
      }
    } catch (error) { 
      console.error('Load tenant core data error:', error); 
      toast.error('Failed to load core dashboard data'); 
    }
    finally { 
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
    if (error || !user) { localStorage.clear(); router.push('/login'); return null; }
    const { data: userRecord, error: roleError } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (roleError || !userRecord) { localStorage.clear(); router.push('/login'); return null; }
    return { user, role: userRecord.role };
  };

  useEffect(() => {
    const init = async () => {
      const auth = await checkAuthAndRedirect();
      if (!auth) return;
      if (auth.role !== 'tenant') { router.push('/login'); return; }
      localStorage.setItem('userId', auth.user.id);
      await loadTenantData(auth.user.id, false);
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { localStorage.clear(); router.push('/login'); }
    });
    return () => { if (subscription) subscription.unsubscribe(); };
  }, []);

  return (
    <TenantContext.Provider value={{ 
      loading, 
      isRefreshing, 
      tenant, 
      room, 
      property, 
      owner, 
      roommates, 
      roommateVacateAlert, 
      refreshData, 
      setTenant 
    }}>
      {children}
    </TenantContext.Provider>
  );
}
export const useTenant = () => useContext(TenantContext);