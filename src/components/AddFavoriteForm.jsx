import { useState } from 'react';
import { createFavorite } from '../lib/favorites';
import styles from './AddFavoriteForm.module.css';

// Every submission is an INSERT — the previous "current" favorite stays
// in the DB as part of the history that the future replay feature will
// surface. See src/lib/favorites.js.
export default function AddFavoriteForm({
  partnershipId,
  authorId,
  onCreated,
  onClose,
}) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = body.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const f = await createFavorite({ partnershipId, authorId, body });
      onCreated?.(f);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.title}>Update your favorite</div>

        <p className={styles.prompt}>right now, my favorite thing about you is</p>

        <div className={styles.field}>
          <textarea
            className={styles.input}
            placeholder="…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            autoFocus
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.submit} disabled={!canSubmit} onClick={submit}>
          {busy ? 'Pushing…' : 'Push your updated favorite →'}
        </button>
      </div>
    </div>
  );
}
