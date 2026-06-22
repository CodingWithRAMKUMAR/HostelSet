import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useAdminNotices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotices = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('notices').select('*').order('created_at', { ascending: false });
    if (error) toast.error('Failed to load notices');
    else setNotices(data || []);
    setLoading(false);
  };

  const postNotice = async (title, content, type, isUrgent) => {
    if (!title || !content) { toast.error('Please fill both title and content'); return; }
    const { error } = await supabase.from('notices').insert({ title, content, type, is_urgent: isUrgent, created_at: new Date().toISOString() });
    if (error) toast.error('Failed to post notice: ' + error.message);
    else { toast.success('Global notice posted!'); await loadNotices(); }
  };

  const deleteNotice = async (noticeId) => {
    if (!confirm('Delete this global notice?')) return;
    const { error } = await supabase.from('notices').delete().eq('id', noticeId);
    if (error) toast.error('Failed to delete notice');
    else { toast.success('Notice deleted.'); await loadNotices(); }
  };

  useEffect(() => {
    loadNotices();
    const channel = supabase.channel('admin-notices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, (payload) => {
        if (payload.eventType === 'INSERT') setNotices(prev => [payload.new, ...prev]);
        else if (payload.eventType === 'DELETE') setNotices(prev => prev.filter(n => n.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
  return { notices, loading, postNotice, deleteNotice, refreshNotices: loadNotices };
}
