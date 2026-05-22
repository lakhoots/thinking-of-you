import { useEffect, useRef, useState } from 'react';
import { createSpark, updateSpark } from '../lib/sparks';
import { todayStr } from '../lib/format';
import styles from './AddSparkForm.module.css';

export default function AddSparkForm({
  partnershipId,
  authorId,
  spark,
  onCreated,
  onUpdated,
  onDeleteRequested,
  onClose,
}) {
  const editing = !!spark;

  const initialKeptPhotos = spark?.photos?.length
    ? spark.photos
    : (spark?.image_url ? [{ id: 'cover', image_url: spark.image_url, position: 0 }] : []);

  const [note, setNote] = useState(spark?.note || '');
  const [date, setDate] = useState(spark?.date || todayStr());
  const [keepPhotos, setKeepPhotos] = useState(initialKeptPhotos);
  const [newPhotoFiles, setNewPhotoFiles] = useState([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();
  const noteRef = useRef(null);

  const keepNoteVisible = () => {
    [0, 140, 320].forEach((delay) => {
      window.setTimeout(() => {
        noteRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, delay);
    });
  };

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const onViewportChange = () => {
      if (document.activeElement === noteRef.current) keepNoteVisible();
    };
    vv.addEventListener('resize', onViewportChange);
    vv.addEventListener('scroll', onViewportChange);
    return () => {
      vv.removeEventListener('resize', onViewportChange);
      vv.removeEventListener('scroll', onViewportChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      newPhotoPreviews.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [newPhotoPreviews]);

  const onFile = (e) => {
    const fs = Array.from(e.target.files ?? []);
    if (!fs.length) return;
    setNewPhotoFiles((prev) => [...prev, ...fs]);
    setNewPhotoPreviews((prev) => [...prev, ...fs.map((f) => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const removeKeptPhoto = (id) => {
    setKeepPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const removeNewPhoto = (i) => {
    setNewPhotoFiles((prev) => prev.filter((_, idx) => idx !== i));
    setNewPhotoPreviews((prev) => {
      URL.revokeObjectURL(prev[i]);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const totalPhotos = keepPhotos.length + newPhotoFiles.length;

  const canSubmit = note.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        const updated = await updateSpark({
          sparkId: spark.id,
          partnershipId,
          patch: {
            note: note.trim(),
            date,
          },
          // Pre-existing cover-only sparks have a synthetic 'cover' photo
          // id that isn't a real spark_photos row — strip those before
          // sending so the server reconciles the photo set cleanly.
          keepPhotoIds: keepPhotos
            .map((p) => p.id)
            .filter((id) => id !== 'cover'),
          newPhotoFiles,
        });
        onUpdated?.(updated);
      } else {
        const s = await createSpark({
          partnershipId,
          authorId,
          note,
          date,
          photoFiles: newPhotoFiles,
        });
        onCreated?.(s);
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const onDelete = () => {
    if (!editing) return;
    onDeleteRequested?.(spark.id);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.title}>{editing ? 'Edit spark' : 'New spark'}</div>

        <div className={styles.field}>
          <label className={styles.label}>Note</label>
          <textarea
            ref={noteRef}
            className={styles.input}
            placeholder="saw this and thought of you…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onFocus={keepNoteVisible}
            onClick={keepNoteVisible}
            rows={3}
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

        <div className={styles.field}>
          <label className={styles.label}>
            Photos
            {totalPhotos > 1
              ? <span className={styles.optional}>{totalPhotos} in stack</span>
              : <span className={styles.optional}>optional</span>}
          </label>
          {totalPhotos === 0 ? (
            <div className={styles.upload} onClick={() => fileRef.current?.click()}>
              <div className={styles.uploadIcon}>📷</div>
              <div className={styles.uploadHint}>Tap to add photos</div>
            </div>
          ) : (
            <div className={styles.previewStrip}>
              {keepPhotos.map((p) => (
                <div key={p.id} className={styles.previewItem}>
                  <img src={p.image_url} alt="" />
                  <button
                    type="button"
                    className={styles.previewRemove}
                    onClick={() => removeKeptPhoto(p.id)}
                    aria-label="Remove photo"
                  >×</button>
                </div>
              ))}
              {newPhotoPreviews.map((src, i) => (
                <div key={src} className={styles.previewItem}>
                  <img src={src} alt="" />
                  <button
                    type="button"
                    className={styles.previewRemove}
                    onClick={() => removeNewPhoto(i)}
                    aria-label="Remove photo"
                  >×</button>
                </div>
              ))}
              <button
                type="button"
                className={styles.previewAdd}
                onClick={() => fileRef.current?.click()}
                aria-label="Add another photo"
              >+</button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={onFile}
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
            {busy ? 'Sending…' : 'Send spark →'}
          </button>
        )}
      </div>
    </div>
  );
}
