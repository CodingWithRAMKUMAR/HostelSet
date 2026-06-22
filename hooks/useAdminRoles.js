import { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useAdminRoles() {
  const [loading, setLoading] = useState(false);

  const changeUserRole = async (userId, newRole) => {
    if (!userId) { toast.error('Invalid user ID.'); return false; }
    if (!['owner', 'tenant', 'admin'].includes(newRole)) { toast.error('Invalid role selection.'); return false; }
    setLoading(true);
    try {
      const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId);
      if (error) throw error;
      toast.success(`✅ User role changed to ${newRole}.`);
      return true;
    } catch (error) {
      console.error('Change role error:', error);
      toast.error('Failed to change role: ' + error.message);
      return false;
    } finally { setLoading(false); }
  };

  return { changeUserRole, loading };
}
