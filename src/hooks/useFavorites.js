import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { listFavorites } from '../lib/favorites';

// Favorites are INSERT-only — see src/lib/favorites.js for the rationale.
// The page derives the "current" favorite per author by picking the first
// row per author from this sorted-desc list.
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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partnershipId]);

  const addLocal = useCallback((f) => {
    setFavorites((prev) => {
      if (prev.some((x) => x.id === f.id)) return prev;
      return [f, ...prev];
    });
  }, []);

  return { favorites, loading, refresh, addLocal };
}
