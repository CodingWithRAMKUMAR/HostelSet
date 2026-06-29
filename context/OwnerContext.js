import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { calculateRentDueStatus } from '../lib/utils';
import toast from 'react-hot-toast';

const OwnerContext = createContext();

export function OwnerProvider({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [property, setProperty] = useState(null);
  const [propertyImages, setPropertyImages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [settings, setSettings] = useState({ joining_fee:0, advance_months:1, due_day:5, upi_id:'', upi_phone:'' });
  const [stats, setStats] = useState({ totalRooms:0, occupied:0, vacant:0, totalCollected:0, pendingAmount:0, totalComplaints:0, pendingVacate:0, overdueCount:0, noticePeriodCount:0, pendingPaymentCount:0, pendingRentConfirmations:0, monthlyIncome:0 });
  const [membershipActive, setMembershipActive] = useState(false);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState('loading');
  const [membershipExpiry, setMembershipExpiry] = useState(null);
  const [daysLeft, setDaysLeft] = useState(null);
  const [roomMonthlyIncome, setRoomMonthlyIncome] = useState({});
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const autoRefreshRef = useRef(null);

  const updateMembershipFromProperty = (propertyData) => {
    if (!propertyData) { setMembershipActive(false); setMembershipStatus('none'); setMembershipExpiry(null); setDaysLeft(null); return; }
    const active = propertyData.membership_active && new Date(propertyData.membership_expiry) > new Date();
    setMembershipActive(active);
    setMembershipStatus(active?'active':(propertyData.membership_active?'expired':'none'));
    if (propertyData.membership_expiry) {
      const expiryDate = new Date(propertyData.membership_expiry);
      const today = new Date();
      const remainingDays = Math.ceil((expiryDate - today) / (1000*60*60*24));
      setDaysLeft(remainingDays); setMembershipExpiry(expiryDate);
    } else { setMembershipExpiry(null); setDaysLeft(null); }
  };

  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true); else setIsRefreshing(true);
    try {
      const userId = localStorage.getItem('userId');
      const { data: propertyData } = await supabase.from('properties').select('*').eq('owner_id', userId).maybeSingle();
      if (propertyData) {
        setProperty(propertyData); setPropertyImages(propertyData.photos || []); updateMembershipFromProperty(propertyData);
        
        // Rooms and tenants are independent after the property is known, so load them together.
        const [{ data: roomsData, error: roomsError }, { data: tenantsData, error: tenantsError }] = await Promise.all([
          supabase.from('rooms').select('*').eq('property_id', propertyData.id).order('room_number'),
          supabase.from('tenants').select('*').eq('property_id', propertyData.id),
        ]);
        if (roomsError) throw roomsError;
        if (tenantsError) throw tenantsError;
        setRooms(roomsData || []);
        const total = roomsData?.length || 0; const occupied = roomsData?.filter(r => r.current_occupants >= r.capacity).length || 0; const vacant = total - occupied;
        const tenantsWithRoomNumber = (tenantsData || []).map(t => { const room = roomsData?.find(r => r.id === t.room_id); return { ...t, room_number: room ? room.room_number : 'N/A', dueStatus: calculateRentDueStatus(t) } });
        setTenants(tenantsWithRoomNumber);
        
        // Stats and Finance
        const totalCollected = tenantsData?.reduce((sum, t) => sum + Number(t.total_paid || 0), 0) || 0;
        const pendingAmount = tenantsData?.reduce((sum, t) => sum + Number(t.pending_amount || 0), 0) || 0;
        const overdueCount = tenantsWithRoomNumber.filter(t => t.dueStatus.status === 'overdue').length;
        const noticePeriodCount = tenantsWithRoomNumber.filter(t => t.status === 'notice_period').length;
        const pendingPaymentCount = tenantsWithRoomNumber.filter(t => t.status === 'payment_pending').length;
        const tenantIds = tenantsData?.map(t => t.id) || [];
        const now = new Date(); const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]; const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        const [monthlyResult, pendingResult, complaintResult, vacateResult] = await Promise.all([
          tenantIds.length
            ? supabase.from('payment_history').select('amount').eq('status', 'success').gte('payment_date', startOfMonth).lte('payment_date', endOfMonth).in('tenant_id', tenantIds)
            : Promise.resolve({ data: [] }),
          tenantIds.length
            ? supabase.from('payment_history').select('id').eq('status', 'payment_pending').in('tenant_id', tenantIds)
            : Promise.resolve({ data: [] }),
          supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('property_id', propertyData.id).in('status', ['open', 'in_progress']),
          supabase.from('check_out_requests').select('*', { count: 'exact', head: true }).eq('property_id', propertyData.id).eq('status', 'pending'),
        ]);
        const monthlyIncome = monthlyResult.data?.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) || 0;
        const pendingRentConfirmations = pendingResult.data?.length || 0;
        const complaintCount = complaintResult.count;
        const vacateCount = vacateResult.count;

        setStats({ totalRooms:total, occupied, vacant, totalCollected, pendingAmount, totalComplaints:complaintCount||0, pendingVacate:vacateCount||0, overdueCount, noticePeriodCount, pendingPaymentCount, pendingRentConfirmations, monthlyIncome });
        return propertyData;
      }
      return null;
    } catch (error) { console.error('Load error:', error); if (!isBackground) toast.error('Failed to load data: ' + error.message); return null; }
    finally { if (!isBackground) setLoading(false); else setIsRefreshing(false); }
  }, []);

  const startAutoRefresh = () => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    autoRefreshRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') loadData(true);
    }, 120000);
  };

  // Auth and Init
  const checkAuthAndRedirect = async () => {
    const { data:{session}, error } = await supabase.auth.getSession();
    const user = session?.user;
    if (error || !user) { localStorage.clear(); router.push('/login'); return null; }
    const { data:userRecord, error:roleError } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (roleError || !userRecord) { localStorage.clear(); router.push('/login'); return null; }
    return { user, role: userRecord.role };
  };

  const loadSettings = async (loadedProperty = null) => {
    try {
      const userId = localStorage.getItem('userId');
      const { data, error } = await supabase.from('owner_settings').select('*').eq('owner_id', userId).maybeSingle();
      if (error) throw error;
      if (data) setSettings({ joining_fee:data.joining_fee||0, advance_months:data.advance_months||1, due_day:data.due_day||5, upi_id:data.upi_id||'', upi_phone:data.upi_phone||'' });
      else setSettings({ joining_fee:0, advance_months:1, due_day:5, upi_id:(loadedProperty || property)?.owner_upi_id||'', upi_phone:'' });
    } catch (error) { console.error('Error loading settings:', error); toast.error('Failed to load settings'); }
  };

  const saveSettings = async (newSettings) => {
    const userId = localStorage.getItem('userId');
    const { data: existing } = await supabase.from('owner_settings').select('id').eq('owner_id', userId).maybeSingle();
    const updateData = { joining_fee:newSettings.joining_fee, advance_months:newSettings.advance_months, due_day:newSettings.due_day, upi_id:newSettings.upi_id, upi_phone:newSettings.upi_phone, updated_at:new Date().toISOString() };
    let error;
    if (existing) { const { error: updateError } = await supabase.from('owner_settings').update(updateData).eq('owner_id', userId); error = updateError; }
    else { const { error: insertError } = await supabase.from('owner_settings').insert({ owner_id:userId, ...updateData }); error = insertError; }
    if (error) throw error;
    if (property && newSettings.upi_id) await supabase.from('properties').update({ owner_upi_id:newSettings.upi_id }).eq('id', property.id);
    setSettings(newSettings); await loadData(true);
  };

  const initiateMembershipPayment = async (planId, amount) => {
    setMembershipLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please log in again');
      const response = await fetch('/api/payment/create-membership-order', { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}`}, body:JSON.stringify({ ownerId:session.user.id, planId }) });
      const data = await response.json();
      if (data.success) { window.open(data.paymentLink, '_blank'); toast.success('Redirecting...'); setTimeout(async () => { const refreshedProperty = await loadData(true); const isActive = refreshedProperty?.membership_active && new Date(refreshedProperty.membership_expiry) > new Date(); if (isActive) { setMembershipStatus('active'); startAutoRefresh(); toast.success('✅ Membership activated! Reloading...'); window.location.reload(); } else { toast('Payment processing...', { icon:'⏳' }); } }, 15000); }
      else toast.error(data.error || 'Payment initiation failed');
    } catch (error) { console.error('Membership payment error:', error); toast.error('Failed to initiate payment'); }
    finally { setMembershipLoading(false); }
  };

  useEffect(() => {
    const init = async () => {
      const auth = await checkAuthAndRedirect();
      if (!auth) return; if (auth.role !== 'owner') { router.push('/login'); return; }
      localStorage.setItem('userId', auth.user.id); localStorage.setItem('userEmail', auth.user.email || ''); localStorage.setItem('userName', auth.user.user_metadata?.full_name || '');
      const loadedProperty = await loadData(false); await loadSettings(loadedProperty);
      const membershipExpired = loadedProperty?.membership_active && loadedProperty.membership_expiry && new Date(loadedProperty.membership_expiry) <= new Date();
      if (membershipExpired) { router.push('/owner/subscribe?reason=expired'); return; }
      startAutoRefresh();
    };
    init();
    const { data:{subscription} } = supabase.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT') { localStorage.clear(); router.push('/login'); } });
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); if (subscription) subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!property?.id) return undefined;

    let timer;
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => loadData(true), 300);
    };
    const channel = supabase
      .channel(`owner-core-live:${property.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'properties', filter:`id=eq.${property.id}` }, scheduleRefresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'rooms', filter:`property_id=eq.${property.id}` }, scheduleRefresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'tenants', filter:`property_id=eq.${property.id}` }, scheduleRefresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'payment_history' }, scheduleRefresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'complaints', filter:`property_id=eq.${property.id}` }, scheduleRefresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'check_out_requests', filter:`property_id=eq.${property.id}` }, scheduleRefresh)
      .on('postgres_changes', { event:'*', schema:'public', table:'owner_settings', filter:`owner_id=eq.${property.owner_id}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => loadSettings(property), 300);
      })
      .subscribe((status) => setRealtimeConnected(status === 'SUBSCRIBED'));

    return () => {
      clearTimeout(timer);
      setRealtimeConnected(false);
      supabase.removeChannel(channel);
    };
  }, [property?.id, property?.owner_id]);

  return (
    <OwnerContext.Provider value={{
      loading, isRefreshing, realtimeConnected, property, propertyImages, setPropertyImages, rooms, tenants, settings, stats, roomMonthlyIncome, setRoomMonthlyIncome, membershipActive, membershipLoading, membershipStatus, membershipExpiry, daysLeft, loadData, loadSettings, saveSettings, initiateMembershipPayment, startAutoRefresh, updateMembershipFromProperty, setTenants, setRooms, setProperty, setStats
    }}>
      {children}
    </OwnerContext.Provider>
  );
}
export const useOwner = () => useContext(OwnerContext);
