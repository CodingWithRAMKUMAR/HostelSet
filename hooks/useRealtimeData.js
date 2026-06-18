import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeData(tableName, queryFilter = null) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // ✅ ADD ERROR STATE

  // Function to fetch initial data
  const fetchData = async () => {
    try {
      let query = supabase.from(tableName).select('*');
      
      // Apply filters if provided (e.g., {column: 'property_id', value: 123})
      if (queryFilter) {
        query = query.eq(queryFilter.column, queryFilter.value);
      }

      const { data, error } = await query;
      
      // ✅ HANDLE ERROR: Set error state if query fails
      if (error) {
        setError(error.message);
        setData([]);
      } else {
        setError(null);
        setData(data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch data');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();

    // Set up the real-time subscription
    const channel = supabase
      .channel(`realtime:${tableName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, (payload) => {
        // If a new row is added
        if (payload.eventType === 'INSERT') {
          setData((prev) => [...prev, payload.new]);
        }
        // If an existing row is updated
        if (payload.eventType === 'UPDATE') {
          setData((prev) => prev.map(item => item.id === payload.new.id ? payload.new : item));
        }
        // If a row is deleted
        if (payload.eventType === 'DELETE') {
          setData((prev) => prev.filter(item => item.id !== payload.old.id));
        }
      })
      .subscribe((status) => {
        // ✅ HANDLE SUBSCRIPTION STATUS
        if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          setError('Real-time connection lost');
        } else if (status === 'SUBSCRIBED') {
          setError(null);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName]); // Re-run if table name changes

  return { data, loading, error }; // ✅ RETURN ERROR STATE
}