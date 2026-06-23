import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const AdminContext = createContext();

export function AdminProvider({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(null);
  const [globalStats, setGlobalStats] = useState({
    totalProperties: 0,
    totalTenants: 0,
    totalRevenue: 0,
    pendingComplaints: 0,
    pendingVacates: 0,
  });

  const checkAuthAndRedirect = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) { localStorage.clear(); router.push('/login'); return null; }
    const { data: userRecord, error: roleError } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (roleError || !userRecord || userRecord.role !== 'admin') {
      toast.error('Access Denied: Admins only.');
      router.push('/login'); return null;
    }
    return { user, role: userRecord.role };
  };

  const loadGlobalStats = useCallback(async () => {
    try {
      const [{ count: propCount }, { count: tenantCount }, { data: payments }] = await Promise.all([
        supabase.from('properties').select('*', { count: 'exact', head: true }),
        supabase.from('tenants').select('*', { count: 'exact', head: true }),
        supabase.from('payment_history').select('amount').eq('status', 'success')
      ]);
      const totalRevenue = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const { count: complaintCount } = await supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'open');
      const { count: vacateCount } = await supabase.from('check_out_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      
      setGlobalStats({
        totalProperties: propCount || 0,
        totalTenants: tenantCount || 0,
        totalRevenue,
        pendingComplaints: complaintCount || 0,
        pendingVacates: vacateCount || 0,
      });
    } catch (error) { console.error('Failed to load global stats:', error); }
  }, []);

  useEffect(() => {
    const init = async () => {
      const auth = await checkAuthAndRedirect();
      if (!auth) return;
      setAdmin(auth.user);
      localStorage.setItem('userId', auth.user.id);
      await loadGlobalStats();
      setLoading(false);
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { localStorage.clear(); router.push('/login'); }
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  return (
    <AdminContext.Provider value={{ loading, admin, globalStats, refreshStats: loadGlobalStats }}>
      {children}
    </AdminContext.Provider>
  );
}
export const useAdmin = () => useContext(AdminContext);
