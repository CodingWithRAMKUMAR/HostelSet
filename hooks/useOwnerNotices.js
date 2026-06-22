import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export function useOwnerNotices(property) {
  const [notices, setNotices] = useState([]);

  const loadNotices = async () => {
    if (!property?.id) return;
    const { data } = await supabase.from('notices').select('*').eq('property_id', property.id).order('created_at', { ascending: false });
    setNotices(data || []);
  };

  const postNotice = async (title, content, type, isUrgent) => {
    if (!title || !content) { toast.error('Please fill both title and content'); return false; }
    const { error } = await supabase.from('notices').insert({ property_id:property.id, title, content, type, is_urgent:isUrgent, created_at:new Date().toISOString() });
    if (error) { toast.error('Failed to post notice: ' + error.message); return false; }
    toast.success('Notice posted!'); return true;
  };

  const deleteNotice = async (noticeId) => {
    if (!confirm('Delete this notice?')) return;
    const { error } = await supabase.from('notices').delete().eq('id', noticeId);
    if (error) { toast.error('Failed to delete notice'); return false; }
    toast.success('Notice deleted'); return true;
  };

  useEffect(() => {
    if (!property?.id) return;
    loadNotices();
    const channel = supabase.channel('owner-notices')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'notices' }, (payload) => {
        if (payload.new?.property_id === property.id) setNotices(prev => [payload.new, ...prev]);
      })
      .on('postgres_changes', { event:'DELETE', schema:'public', table:'notices' }, (payload) => {
        if (payload.old?.property_id === property.id) setNotices(prev => prev.filter(n => n.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [property?.id]);

  return { notices, postNotice, deleteNotice };
}
