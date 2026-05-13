import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function usePartnership(partnershipId) {
  const [partnership, setPartnership] = useState(null);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!partnershipId) {
      setPartnership(null);
      setPartners([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: p, error } = await supabase
      .from('partnerships')
      .select('*')
      .eq('id', partnershipId)
      .maybeSingle();
    if (error) console.error('partnership fetch', error);
    setPartnership(p ?? null);

    if (p) {
      const ids = [p.partner_a_id, p.partner_b_id].filter(Boolean);
      if (ids.length) {
        const { data: people } = await supabase
          .from('profiles')
          .select('id, name, photo_url, accent_color')
          .in('id', ids);
        setPartners(people ?? []);
      } else {
        setPartners([]);
      }
    }
    setLoading(false);
  }, [partnershipId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { partnership, partners, loading, refresh };
}
