import { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useAdminMembership() {
  const [loading, setLoading] = useState(false);

  const grantMembership = async (ownerId, days, reason = 'Manual Grant') => {
    if (!ownerId) { toast.error('Please select an owner.'); return false; }
    if (!days || days < 1) { toast.error('Enter a valid number of days (minimum 1).'); return false; }
    setLoading(true);
    try {
      const { data: propertyData, error: fetchError } = await supabase
        .from('properties')
        .select('id, membership_active, membership_expiry')
        .eq('owner_id', ownerId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (!propertyData) { toast.error('This owner does not have a registered property.'); return false; }

      const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      const { error: updateError } = await supabase
        .from('properties')
        .update({ membership_active: true, membership_expiry: newExpiry.toISOString() })
        .eq('id', propertyData.id);
      if (updateError) throw updateError;

      toast.success(`✅ Membership granted for ${days} days. Expires on ${newExpiry.toLocaleDateString()}.`);
      return true;
    } catch (error) {
      console.error('Grant membership error:', error);
      toast.error('Failed to grant membership: ' + error.message);
      return false;
    } finally { setLoading(false); }
  };

  const revokeMembership = async (ownerId) => {
    if (!ownerId) { toast.error('Please select an owner.'); return false; }
    if (!confirm('Revoke this owner\'s membership immediately? This cannot be undone.')) return false;
    setLoading(true);
    try {
      const { data: propertyData, error: fetchError } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_id', ownerId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (!propertyData) { toast.error('Property not found.'); return false; }

      const { error: updateError } = await supabase
        .from('properties')
        .update({ membership_active: false, membership_expiry: new Date().toISOString() })
        .eq('id', propertyData.id);
      if (updateError) throw updateError;

      toast.success('✅ Membership has been revoked immediately.');
      return true;
    } catch (error) {
      console.error('Revoke membership error:', error);
      toast.error('Failed to revoke membership: ' + error.message);
      return false;
    } finally { setLoading(false); }
  };

  return { grantMembership, revokeMembership, loading };
}
