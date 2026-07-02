import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useAdminNotices(enabled = true) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotices = async (background = false) => {
    if (!background) setLoading(true);
    const { data, error } = await supabase.from('notices').select('*').order('created_at', { ascending: false });
    if (error) toast.error('Failed to load notices');
    else setNotices(data || []);
    setLoading(false);
  };

  const postNotice = async (title, content, type, isUrgent) => {
    if (!title || !content) { toast.error('Please fill both title and content'); return false; }
    const { error } = await supabase.from('notices').insert({ title, content, type, is_urgent: isUrgent, created_at: new Date().toISOString() });
    if (error) { toast.error('Failed to post notice: ' + error.message); return false; }
    toast.success('Global notice posted!');
    await loadNotices();
    return true;
  };

  const deleteNotice = async (noticeId) => {
    if (!confirm('Delete this global notice?')) return;
    const { error } = await supabase.from('notices').delete().eq('id', noticeId);
    if (error) toast.error('Failed to delete notice');
    else { toast.success('Notice deleted.'); await loadNotices(); }
  };

  useEffect(() => { if (enabled) loadNotices(); }, [enabled]);
  useRealtimeRefresh('admin-notices-live', ['notices'], loadNotices, enabled);
  return { notices, loading, postNotice, deleteNotice, refreshNotices: loadNotices };
}
