import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useAdminUsers(enabled = true) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Fetch all users
  const loadUsers = async (background = false) => {
    if (!background) setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load users: ' + error.message);
    else setUsers(data || []);
    setLoading(false);
  };

  // Toggle Active Status
  const toggleUserStatus = async (userId, currentStatus) => {
    const newStatus = !currentStatus;
    // Optimistic UI update
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: newStatus } : u));
    
    const { error } = await supabase.from('users').update({ is_active: newStatus }).eq('id', userId);
    if (error) {
      toast.error('Failed to update user status');
      // Rollback on error
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: currentStatus } : u));
    } else {
      toast.success(`User ${newStatus ? 'Activated' : 'Deactivated'}`);
    }
  };

  // Change User Role
  const changeUserRole = async (userId, newRole) => {
    if (!['owner', 'tenant', 'admin'].includes(newRole)) {
      toast.error('Invalid role selection');
      return;
    }
    // Optimistic UI update
    const prevUsers = users;
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));

    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId);
    if (error) {
      toast.error('Failed to change role: ' + error.message);
      // Rollback on error
      setUsers(prevUsers);
    } else {
      toast.success(`User role changed to ${newRole}`);
    }
  };

  useEffect(() => { if (enabled) loadUsers(); }, [enabled]);
  useRealtimeRefresh('admin-users-live', ['users'], loadUsers, enabled);

  // Filtered & Search Logic
  const filteredUsers = useMemo(() => {
    let result = users;
    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(u => 
        u.full_name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.phone?.includes(term)
      );
    }
    return result;
  }, [users, searchTerm, roleFilter]);

  return { 
    users: filteredUsers, 
    loading, 
    searchTerm, 
    setSearchTerm, 
    roleFilter, 
    setRoleFilter,
    toggleUserStatus, 
    changeUserRole,
    refreshUsers: loadUsers 
  };
}
