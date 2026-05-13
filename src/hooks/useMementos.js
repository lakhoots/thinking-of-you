import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { listMementos } from '../lib/mementos';

export function useMementos(partnershipId) {
  const [mementos, setMementos] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!partnershipId) {
      setMementos([]);
      setLoading(false);
      return;
    }
    try {
      const data = await listMementos(partnershipId);
      setMementos(data);
    } catch (err) {
      console.error('mementos fetch', err);
    } finally {
      setLoading(false);
    }
  }, [partnershipId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime subscription.
  useEffect(() => {
    if (!partnershipId) return;
    const channel = supabase
      .channel(`mementos-${partnershipId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mementos',
          filter: `partnership_id=eq.${partnershipId}`,
        },
        (payload) => {
          setMementos((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'mementos',
          filter: `partnership_id=eq.${partnershipId}`,
        },
        (payload) => {
          setMementos((prev) => prev.filter((m) => m.id !== payload.old.id));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partnershipId]);

  const addLocal = useCallback((m) => {
    setMementos((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, []);

  return { mementos, loading, refresh, addLocal };
}
