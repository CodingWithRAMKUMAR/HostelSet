import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useRealtimeRefresh } from './useRealtimeRefresh';

export function useOwnerNotices(property, enabled = true) {
  const [notices, setNotices] = useState([]);

  const loadNotices = async () => {
    if (!property?.id) return;
    const { data } = await supabase.from('notices').select('*').or(`property_id.eq.${property.id},property_id.is.null`).order('created_at', { ascending: false });
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
    if (property?.id && enabled) loadNotices();
  }, [property?.id, enabled]);
  useRealtimeRefresh(`owner-notices-live:${property?.id || 'waiting'}`, ['notices'], loadNotices, Boolean(property?.id && enabled));

  return { notices, postNotice, deleteNotice };
}
