import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { listMementos, fetchMementoPhotos, fetchMementoListItems } from '../lib/mementos';

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
            // Photos / list items populate via their own realtime streams.
            return [...prev, { ...payload.new, photos: [], list_items: [] }];
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mementos',
          filter: `partnership_id=eq.${partnershipId}`,
        },
        (payload) => {
          setMementos((prev) =>
            prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m)),
          );
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'memento_photos' },
        async (payload) => {
          // RLS limits these events to our partnership. Refetch the affected
          // memento's photos so order and cover stay consistent.
          const mementoId = payload.new?.memento_id || payload.old?.memento_id;
          if (!mementoId) return;
          try {
            const photos = await fetchMementoPhotos(mementoId);
            setMementos((prev) =>
              prev.map((m) => (m.id === mementoId ? { ...m, photos } : m)),
            );
          } catch (err) {
            console.error('memento_photos refetch', err);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'memento_list_items' },
        async (payload) => {
          // RLS limits these events to our partnership. Refetch the affected
          // list's items so both partners stay in sync as items are added,
          // checked off, edited, or removed.
          const mementoId = payload.new?.memento_id || payload.old?.memento_id;
          if (!mementoId) return;
          try {
            const list_items = await fetchMementoListItems(mementoId);
            setMementos((prev) =>
              prev.map((m) => (m.id === mementoId ? { ...m, list_items } : m)),
            );
          } catch (err) {
            console.error('memento_list_items refetch', err);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partnershipId]);

  const addLocal = useCallback((m) => {
    setMementos((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, []);

  const updateLocal = useCallback((m) => {
    setMementos((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
  }, []);

  const removeLocal = useCallback((id) => {
    setMementos((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return { mementos, loading, refresh, addLocal, updateLocal, removeLocal };
}
