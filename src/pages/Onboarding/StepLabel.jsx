import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import styles from './Onboarding.module.css';

export default function StepLabel({ userId, onDone }) {
  const [label, setLabel] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!label.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data: p, error: insErr } = await supabase
        .from('partnerships')
        .insert({ label: label.trim(), partner_a_id: userId })
        .select()
        .single();
      if (insErr) throw insErr;

      const { error: profErr } = await supabase
        .from('profiles')
        .update({ partnership_id: p.id })
        .eq('id', userId);
      if (profErr) throw profErr;

      onDone(p);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.card}>
      <div>
        <div className={styles.stepLabel}>Step 2 of 3</div>
        <div className={styles.title} style={{ marginTop: 6 }}>Name the two of you</div>
      </div>

      <div className={styles.sub}>
        A short label for your shared space. Just for you both — you can change it later.
      </div>

      <div className={styles.field}>
        <input
          className={styles.input}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Lauren & Utku"
          autoFocus
        />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <button
        className={styles.cta}
        disabled={!label.trim() || busy}
        onClick={submit}
      >
        {busy ? '…' : 'Continue →'}
      </button>
    </div>
  );
}
