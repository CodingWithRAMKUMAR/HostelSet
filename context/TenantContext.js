import { createContext, useContext, useState, useEffect } from 'react';
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

  useEffect(() => {
    const loadTenant = async () => {
      console.log("🔍 STEP 1: Tenant useEffect started.");
      
      // 1. Check auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.log("🔍 STEP 2: User not logged in.");
        toast.error('Please log in again.');
        localStorage.clear();
        router.push('/login');
        return;
      }
      console.log("🔍 STEP 2: User found:", user.id);

      // 2. Check role
      const { data: userRecord, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (roleError || !userRecord || userRecord.role !== 'tenant') {
        console.log("🔍 STEP 3: User is not a tenant.");
        toast.error('Access denied. You are not registered as a tenant.');
        router.push('/login');
        return;
      }
      console.log("🔍 STEP 3: User role is tenant.");

      // 3. Fetch tenant data
      console.log("🔍 STEP 4: Fetching tenant data from Supabase...");
      const { data: tenantData, error: fetchError } = await supabase
        .from('tenants')
        .select('*, rooms:room_id(*), property:property_id(*)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error("🔍 STEP 5: Supabase Error:", fetchError);
        setError(fetchError.message);
        toast.error('DB Error: ' + fetchError.message);
        setLoading(false);
        return;
      }

      console.log("🔍 STEP 5: Supabase returned:", tenantData);

      if (!tenantData) {
        console.warn("🔍 STEP 6: No tenant record found.");
        toast.error('No tenant record found. You may need to be added to a room by your owner.');
        setLoading(false);
        return;
      }

      // 4. Set state
      console.log("🔍 STEP 7: Setting tenant data...");
      setTenant(tenantData);
      setRoom(tenantData.rooms);
      setProperty(tenantData.property);
      setRoommates(tenantData.roommates || []);
      setLoading(false);
      console.log("✅ DONE: Tenant dashboard loaded successfully!");
    };

    loadTenant();
  }, []);

  return (
    <TenantContext.Provider value={{ 
      loading, 
      tenant, 
      room, 
      property, 
      owner, 
      roommates, 
      roommateVacateAlert,
      error
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);