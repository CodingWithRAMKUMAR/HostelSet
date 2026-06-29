import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeData(tableName, queryFilter = null) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Function to fetch initial data
  const fetchData = async () => {
    let query = supabase.from(tableName).select('*');
    
    // Apply filters if provided (e.g., {column: 'property_id', value: 123})
    if (queryFilter) {
      query = query.eq(queryFilter.column, queryFilter.value);
    }

    const { data, error } = await query;
    if (!error) setData(data);
    setLoading(false);
  };

  useEffect(() => {
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableName]); // Re-run if table name changes

  return { data, loading };
}
