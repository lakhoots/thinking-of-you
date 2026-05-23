import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { listSparks, fetchSparkPhotos } from '../lib/sparks';

function sortCommentsNewestFirst(comments) {
  return (comments ?? []).slice().sort((a, b) =>
    (a.created_at < b.created_at ? 1 : -1),
  );
}

function sortViewsNewestFirst(views) {
  return (views ?? []).slice().sort((a, b) =>
    (a.seen_at < b.seen_at ? 1 : -1),
  );
}

export function useSparks(partnershipId) {
  const [sparks, setSparks] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!partnershipId) {
      setSparks([]);
      setLoading(false);
      return;
    }
    try {
      const data = await listSparks(partnershipId);
      setSparks(data);
    } catch (err) {
      console.error('sparks fetch', err);
    } finally {
      setLoading(false);
    }
  }, [partnershipId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!partnershipId) return;
    const channel = supabase
      .channel(`sparks-${partnershipId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sparks',
          filter: `partnership_id=eq.${partnershipId}`,
        },
        (payload) => {
          setSparks((prev) => {
            if (prev.some((s) => s.id === payload.new.id)) return prev;
            return [{ ...payload.new, photos: [], comments: [], views: [] }, ...prev];
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sparks',
          filter: `partnership_id=eq.${partnershipId}`,
        },
        (payload) => {
          setSparks((prev) =>
            prev.map((s) => (s.id === payload.new.id ? { ...s, ...payload.new } : s)),
          );
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'sparks',
          filter: `partnership_id=eq.${partnershipId}`,
        },
        (payload) => {
          setSparks((prev) => prev.filter((s) => s.id !== payload.old.id));
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'spark_photos' },
        async (payload) => {
          // RLS filters these to our partnership. Refetch the affected
          // spark's photos so order and cover stay consistent.
          const sparkId = payload.new?.spark_id || payload.old?.spark_id;
          if (!sparkId) return;
          try {
            const photos = await fetchSparkPhotos(sparkId);
            setSparks((prev) =>
              prev.map((s) => (s.id === sparkId ? { ...s, photos } : s)),
            );
          } catch (err) {
            console.error('spark_photos refetch', err);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'spark_comments' },
        (payload) => {
          const comment = payload.new;
          setSparks((prev) =>
            prev.map((s) => {
              if (s.id !== comment.spark_id) return s;
              if (s.comments?.some((c) => c.id === comment.id)) return s;
              return {
                ...s,
                comments: sortCommentsNewestFirst([...(s.comments ?? []), comment]),
              };
            }),
          );
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'spark_views' },
        (payload) => {
          const view = payload.new ?? payload.old;
          if (!view?.spark_id) return;
          setSparks((prev) =>
            prev.map((s) => {
              if (s.id !== view.spark_id) return s;
              if (payload.eventType === 'DELETE') {
                return {
                  ...s,
                  views: (s.views ?? []).filter((v) => v.id !== view.id),
                };
              }
              const withoutExisting = (s.views ?? []).filter((v) =>
                v.id !== view.id && v.user_id !== view.user_id,
              );
              return {
                ...s,
                views: sortViewsNewestFirst([...withoutExisting, view]),
              };
            }),
          );
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partnershipId]);

  const addLocal = useCallback((s) => {
    setSparks((prev) => {
      if (prev.some((x) => x.id === s.id)) return prev;
      const next = [...prev, s];
      next.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return next;
    });
  }, []);

  const updateLocal = useCallback((s) => {
    setSparks((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...s } : x)));
  }, []);

  const addCommentLocal = useCallback((sparkId, comment) => {
    setSparks((prev) =>
      prev.map((s) => {
        if (s.id !== sparkId) return s;
        if (s.comments?.some((c) => c.id === comment.id)) return s;
        return {
          ...s,
          comments: sortCommentsNewestFirst([...(s.comments ?? []), comment]),
        };
      }),
    );
  }, []);

  const markSeenLocal = useCallback((sparkId, view) => {
    setSparks((prev) =>
      prev.map((s) => {
        if (s.id !== sparkId) return s;
        const withoutExisting = (s.views ?? []).filter((v) =>
          v.id !== view.id && v.user_id !== view.user_id,
        );
        return {
          ...s,
          views: sortViewsNewestFirst([...withoutExisting, view]),
        };
      }),
    );
  }, []);

  const removeLocal = useCallback((id) => {
    setSparks((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { sparks, loading, refresh, addLocal, updateLocal, addCommentLocal, markSeenLocal, removeLocal };
}
