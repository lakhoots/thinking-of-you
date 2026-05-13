import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import styles from './Onboarding.module.css';

export default function StepInvite({ partnership, onDone }) {
  const [copied, setCopied] = useState(false);
  const [partnerJoined, setPartnerJoined] = useState(false);

  const link = `${window.location.origin}/invite/${partnership.invite_token}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — link is still visible to copy by hand
    }
  };

  // Watch the partnership row — when partner_b_id appears, advance.
  useEffect(() => {
    const channel = supabase
      .channel(`partnership-${partnership.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'partnerships',
          filter: `id=eq.${partnership.id}`,
        },
        (payload) => {
          if (payload.new.partner_b_id) setPartnerJoined(true);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partnership.id]);

  return (
    <div className={styles.card}>
      <div>
        <div className={styles.stepLabel}>Step 3 of 3</div>
        <div className={styles.title} style={{ marginTop: 6 }}>Invite your other half</div>
      </div>

      <div className={styles.sub}>
        Share this link with them. Until they join, only you can see the board.
      </div>

      <div className={styles.inviteBox}>{link}</div>

      <button className={styles.copyBtn} onClick={copy}>
        {copied ? 'Copied ✓' : 'Copy link'}
      </button>

      {partnerJoined ? (
        <div className={styles.waiting} style={{ animation: 'none', color: 'var(--ink)' }}>
          They're in. Welcome.
        </div>
      ) : (
        <div className={styles.waiting}>
          Waiting for them to arrive…
        </div>
      )}

      <button className={styles.skip} onClick={onDone}>
        {partnerJoined ? 'Begin →' : 'Skip for now — I\'ll invite them later'}
      </button>
    </div>
  );
}
