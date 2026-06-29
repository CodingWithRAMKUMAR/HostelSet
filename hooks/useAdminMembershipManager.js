import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useAdminMembershipManager() {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOwners = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        phone,
        properties (
          id,
          membership_active,
          membership_expiry
        )
      `)
      .eq('role', 'owner')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load owners: ' + error.message);
      setOwners([]);
    } else {
      setOwners(data || []);
    }
    setLoading(false);
  };

  const getDaysLeft = (expiryDate) => {
    if (!expiryDate) return null;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const sendRenewalEmail = async (ownerId, ownerEmail, ownerName) => {
    // --- DEBUG LOG TO CHECK THE EMAIL ---
    console.log("🔍 SENDING RENEWAL EMAIL TO:", ownerEmail);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please log in again');
      const response = await fetch('/api/admin/send-renewal-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ownerId })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Renewal email sent to ${ownerName}`);
      } else {
        toast.error(data.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Send email error:', error);
      toast.error('Failed to send renewal email');
    }
  };

  const grantMembership = async (ownerId, days) => {
    if (!ownerId) {
      toast.error('Owner ID is required.');
      return;
    }
    if (!days || days < 1) {
      toast.error('Please enter a valid number of days.');
      return;
    }
    try {
      const { data: propertyData, error: fetchError } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_id', ownerId)
        .maybeSingle();

      if (fetchError || !propertyData) {
        toast.error('Could not find a property for this owner.');
        return;
      }

      const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const { error: updateError } = await supabase
        .from('properties')
        .update({
          membership_active: true,
          membership_expiry: newExpiry.toISOString()
        })
        .eq('id', propertyData.id);

      if (updateError) throw updateError;

      toast.success(`Membership granted for ${days} days.`);
      await loadOwners();
    } catch (error) {
      console.error('Grant membership error:', error);
      toast.error('Failed to grant membership: ' + error.message);
    }
  };

  const revokeMembership = async (ownerId) => {
    if (!ownerId) {
      toast.error('Owner ID is required.');
      return;
    }
    try {
      const { data: propertyData, error: fetchError } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_id', ownerId)
        .maybeSingle();

      if (fetchError || !propertyData) {
        toast.error('Could not find a property for this owner.');
        return;
      }

      const { error: updateError } = await supabase
        .from('properties')
        .update({
          membership_active: false,
          membership_expiry: new Date().toISOString()
        })
        .eq('id', propertyData.id);

      if (updateError) throw updateError;

      toast.success('Membership revoked immediately.');
      await loadOwners();
    } catch (error) {
      console.error('Revoke membership error:', error);
      toast.error('Failed to revoke membership: ' + error.message);
    }
  };

  useEffect(() => {
    loadOwners();
    const channel = supabase.channel('admin-membership-manager')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'properties' }, (payload) => {
        loadOwners();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { owners, loading, getDaysLeft, sendRenewalEmail, grantMembership, revokeMembership, refresh: loadOwners };
}
