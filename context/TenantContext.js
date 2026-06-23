import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const TenantContext = createContext();

export function TenantProvider({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true); // Default to true
  const [tenant, setTenant] = useState(null);
  const [room, setRoom] = useState(null);
  const [property, setProperty] = useState(null);
  const [owner, setOwner] = useState(null);
  const [roommates, setRoommates] = useState([]);
  const [roommateVacateAlert, setRoommateVacateAlert] = useState(null);
  const [error, setError] = useState(null);

  // ONE SINGLE, LINEAR USEFFECT (NO CALLBACKS)
  useEffect(() => {
    console.log("🔍 [1] Tenant useEffect started. Loading: true");

    const loadTenantData = async () => {
      try {
        // --- STEP 1: CHECK AUTH ---
        console.log("🔍 [2] Checking auth...");
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          console.error("🔴 [3] Auth Error:", authError);
          throw new Error(authError.message);
        }

        if (!user) {
          console.warn("🔴 [3] No user found. Redirecting to login.");
          localStorage.clear();
          router.push('/login');
          return;
        }
        console.log("✅ [3] Auth user found:", user.id);

        // --- STEP 2: CHECK ROLE ---
        console.log("🔍 [4] Checking user role...");
        const { data: userRecord, error: roleError } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();

        if (roleError) {
          console.error("🔴 [5] Role Error:", roleError);
          throw new Error(roleError.message);
        }

        if (!userRecord || userRecord.role !== 'tenant') {
          console.warn("🔴 [5] User is not a tenant. Role:", userRecord?.role);
          toast.error('Access denied. You are not registered as a tenant.');
          router.push('/login');
          return;
        }
        console.log("✅ [5] Role validated as tenant.");

        // --- STEP 3: FETCH TENANT DATA ---
        console.log("🔍 [6] Fetching tenant data from Supabase...");
        const { data: tenantData, error: fetchError } = await supabase
          .from('tenants')
          .select('*, rooms:room_id(*), property:property_id(*)')
          .eq('user_id', user.id)
          .maybeSingle();

        if (fetchError) {
          console.error("🔴 [7] Fetch Error:", fetchError);
          throw new Error(fetchError.message);
        }

        console.log("✅ [7] Supabase raw response:", tenantData);

        if (!tenantData) {
          console.warn("🟡 [8] Tenant data is null.");
          setError("No tenant record found in the database.");
          toast.error('No tenant record found. Please ensure you are added to a room.');
          return;
        }
        console.log("✅ [8] Tenant data found.");

        // --- STEP 4: SET STATE ---
        console.log("🔍 [9] Setting state variables...");
        setTenant(tenantData);
        setRoom(tenantData.rooms);
        setProperty(tenantData.property);
        setRoommates(tenantData.roommates || []);
        
        // Fetched owner info
        if (tenantData.property?.owner_id) {
          console.log("🔍 [10] Fetching owner details...");
          const { data: ownerData } = await supabase
            .from('users')
            .select('full_name, phone, email')
            .eq('id', tenantData.property.owner_id)
            .single();
          setOwner(ownerData);
        }

        console.log("✅ [10] State set successfully.");
        setError(null);

      } catch (error) {
        console.error("🔴 CRITICAL ERROR:", error);
        setError(error.message);
        toast.error("Failed to load dashboard: " + error.message);
      } finally {
        // --- STEP 5: ALWAYS TURN OFF LOADING ---
        console.log("🔍 [11] finally block executing. Setting loading = false.");
        setLoading(false);
      }
    };

    // EXECUTE THE FUNCTION
    loadTenantData();

  }, []); // <-- Empty dependency array ensures this runs ONLY once on mount.

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