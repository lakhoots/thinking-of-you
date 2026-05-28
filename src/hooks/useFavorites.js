import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { listFavorites } from '../lib/favorites';

export function useFavorites(partnershipId) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!partnershipId) {
      setFavorites([]);
      setLoading(false);
      return;
    }
    try {
      const data = await listFavorites(partnershipId);
      setFavorites(data);
    } catch (err) {
      console.error('favorites fetch', err);
    } finally {
      setLoading(false);
    }
  }, [partnershipId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!partnershipId) return;
    const channel = supabase
      .channel(`favorites-${partnershipId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'favorites',
          filter: `partnership_id=eq.${partnershipId}`,
        },
        (payload) => {
          setFavorites((prev) => {
            if (prev.some((f) => f.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'favorites',
          filter: `partnership_id=eq.${partnershipId}`,
        },
        (payload) => {
          setFavorites((prev) =>
            prev.map((f) => (f.id === payload.new.id ? { ...f, ...payload.new } : f)),
          );
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'favorites',
          filter: `partnership_id=eq.${partnershipId}`,
        },
        (payload) => {
          setFavorites((prev) => prev.filter((f) => f.id !== payload.old.id));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partnershipId]);

  const addLocal = useCallback((f) => {
    setFavorites((prev) => {
      if (prev.some((x) => x.id === f.id)) return prev;
      const next = [...prev, f];
      next.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return next;
    });
  }, []);

  const updateLocal = useCallback((f) => {
    setFavorites((prev) => prev.map((x) => (x.id === f.id ? { ...x, ...f } : x)));
  }, []);

  const removeLocal = useCallback((id) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return { favorites, loading, refresh, addLocal, updateLocal, removeLocal };
}
