import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useAdminMembershipManager() {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOwners = async () => {
    setLoading(true);
    // We join 'users' (to get name/email) with 'properties' (to get membership_expiry)
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

  // Helper to calculate days left
  const getDaysLeft = (expiryDate) => {
    if (!expiryDate) return null;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Helper to send a renewal email via our API
  const sendRenewalEmail = async (ownerId, ownerEmail, ownerName) => {
    try {
      const response = await fetch('/api/admin/send-renewal-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId, email: ownerEmail, name: ownerName })
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

  useEffect(() => {
    loadOwners();
    
    // Real-time updates for membership changes
    const channel = supabase.channel('admin-membership-manager')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'properties' }, (payload) => {
        // Refresh the list when any property's membership changes
        loadOwners();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { owners, loading, getDaysLeft, sendRenewalEmail, refresh: loadOwners };
}