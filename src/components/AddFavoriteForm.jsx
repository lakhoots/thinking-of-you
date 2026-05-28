import { useEffect, useRef, useState } from 'react';
import { createFavorite, updateFavorite } from '../lib/favorites';
import { todayStr } from '../lib/format';
import styles from './AddFavoriteForm.module.css';

export default function AddFavoriteForm({
  partnershipId,
  authorId,
  favorite,
  onCreated,
  onUpdated,
  onDeleteRequested,
  onClose,
}) {
  const editing = !!favorite;
  const [body, setBody] = useState(favorite?.body || '');
  const [date, setDate] = useState(favorite?.date || todayStr());
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
      if (editing) {
        const updated = await updateFavorite({
          favoriteId: favorite.id,
          patch: { body: body.trim(), date },
        });
        onUpdated?.(updated);
      } else {
        const f = await createFavorite({
          partnershipId,
          authorId,
          body,
          date,
        });
        onCreated?.(f);
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const onDelete = () => {
    if (!editing) return;
    onDeleteRequested?.(favorite.id);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.title}>{editing ? 'Edit favorite' : 'New favorite'}</div>

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
            autoFocus={!editing}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Date</label>
          <input
            className={styles.input}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {editing ? (
          <div className={styles.editActions}>
            <button
              className={styles.deleteBtn}
              onClick={onDelete}
              disabled={busy}
            >
              Delete
            </button>
            <button
              className={styles.submit}
              disabled={!canSubmit}
              onClick={submit}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <button className={styles.submit} disabled={!canSubmit} onClick={submit}>
            {busy ? 'Sending…' : 'Send →'}
          </button>
        )}
      </div>
    </div>
  );
}
