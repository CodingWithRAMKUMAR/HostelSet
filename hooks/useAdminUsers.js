import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useAdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) toast.error('Failed to load users');
    else setUsers(data || []);
    setLoading(false);
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    const newStatus = !currentStatus;
    const { error } = await supabase.from('users').update({ is_active: newStatus }).eq('id', userId);
    if (error) toast.error('Failed to update user status');
    else {
      toast.success(`User ${newStatus ? 'Activated' : 'Deactivated'}`);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: newStatus } : u));
    }
  };

  useEffect(() => { loadUsers(); }, []);
  return { users, loading, toggleUserStatus, refreshUsers: loadUsers };
}
