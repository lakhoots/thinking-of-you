import { useEffect, useRef, useState } from 'react';
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
  const bodyRef = useRef(null);

  const keepBodyVisible = () => {
    [0, 140, 320].forEach((delay) => {
      window.setTimeout(() => {
        bodyRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, delay);
    });
  };

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const onViewportChange = () => {
      if (document.activeElement === bodyRef.current) keepBodyVisible();
    };
    vv.addEventListener('resize', onViewportChange);
    vv.addEventListener('scroll', onViewportChange);
    return () => {
      vv.removeEventListener('resize', onViewportChange);
      vv.removeEventListener('scroll', onViewportChange);
    };
  }, []);

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
            ref={bodyRef}
            className={styles.input}
            placeholder="…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={keepBodyVisible}
            onClick={keepBodyVisible}
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
