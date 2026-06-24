import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useOwnerApplications(property) {
  const [applications, setApplications] = useState([]);

  const loadApplications = async () => {
    if (!property?.id) return;
    const { data } = await supabase
      .from('applications')
      .select('*, rooms(room_number, monthly_rent, capacity)')
      .eq('property_id', property.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setApplications(data || []);
  };

  const approveApplication = async (appId, appData) => {
    if (!appData || typeof appData !== 'object') {
      toast.error('Cannot approve: Application data is missing.');
      return;
    }

    try {
      let userId = appData.user_id || null;

      // --- STEP 1: If no user_id, check if phone number already exists ---
      if (!userId) {
        console.log("🔍 Checking if phone exists:", appData.phone);
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('phone', appData.phone)
          .maybeSingle();

        if (existingUser) {
          // USER ALREADY EXISTS: Use their existing ID
          userId = existingUser.id;
          console.log("✅ Found existing user with ID:", userId);
        } else {
          // USER DOES NOT EXIST: Create Auth user AND public record
          console.log("🛡️ Creating new Auth user for:", appData.email);
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: appData.email,
            password: Math.random().toString(36).slice(-8) + "A1!",
            options: { data: { full_name: appData.name, role: 'tenant', phone: appData.phone } }
          });
          if (authError) throw new Error("Auth creation failed: " + authError.message);
          userId = authData.user.id;
          
          const { error: userInsertError } = await supabase.from('users').insert({ 
            id: userId, 
            email: appData.email, 
            full_name: appData.name, 
            phone: appData.phone, 
            role: 'tenant', 
            is_active: true 
          });
          if (userInsertError) throw userInsertError;
          console.log("✅ New Auth user and public record created.");
        }
      }

      // --- STEP 2: PROCEED WITH ATOMIC APPROVAL ---
      const { data, error } = await supabase.rpc('create_tenant_from_application', {
        p_user_id: userId,
        p_app_id: appId,
        p_property_id: appData.property_id,
        p_room_id: appData.room_id,
        p_name: appData.name,
        p_phone: appData.phone,
        p_email: appData.email,
        p_rent_amount: appData.rooms?.monthly_rent || 0,
        p_move_in_date: appData.expected_move_in || new Date().toISOString().split('T')[0]
      });
      
      if (error) throw error;
      if (data?.success) {
        toast.success('Application approved! Tenant created.');
        await loadApplications();
      } else {
        toast.error(data?.message || 'Failed to create tenant');
      }
    } catch (error) {
      console.error('Approve error:', error);
      toast.error('Failed to approve: ' + error.message);
    }
  };

  const rejectApplication = async (appId) => {
    if (!confirm('Reject this application?')) return;
    const { error } = await supabase
      .from('applications')
      .update({ status: 'rejected', processed_at: new Date().toISOString() })
      .eq('id', appId);
    if (error) toast.error('Failed to reject application: ' + error.message);
    else { toast.success('Application rejected.'); await loadApplications(); }
  };

  const resendPasswordEmail = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(`Password reset email resent to ${email}`);
    } catch (error) {
      console.error('Resend error:', error);
      toast.error('Failed to resend: ' + error.message);
    }
  };

  useEffect(() => {
    if (!property?.id) return;
    loadApplications();
    const channel = supabase.channel('owner-applications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'applications' }, (payload) => {
        if (payload.new?.property_id === property.id) setApplications(prev => [payload.new, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [property?.id]);

  return { applications, approveApplication, rejectApplication, resendPasswordEmail };
}