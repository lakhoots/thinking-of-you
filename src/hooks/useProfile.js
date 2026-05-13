import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) console.error('profile fetch', error);
    setProfile(data ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { profile, loading, refresh };
}
