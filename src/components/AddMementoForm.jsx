import { useRef, useState } from 'react';
import { createMemento } from '../lib/mementos';
import { todayStr } from '../lib/format';
import styles from './AddMementoForm.module.css';

export default function AddMementoForm({ partnershipId, authorId, existing, visibleRect, onCreated, onClose }) {
  const [type, setType] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const onFile = (e) => {
    const fs = Array.from(e.target.files ?? []);
    if (!fs.length) return;
    setPhotoFiles((prev) => [...prev, ...fs]);
    setPhotoPreviews((prev) => [...prev, ...fs.map((f) => URL.createObjectURL(f))]);
    // Reset input so the same file can be picked again if needed.
    e.target.value = '';
  };

  const removePhoto = (i) => {
    setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPhotoPreviews((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      // Revoke the URL we created so we don't leak it.
      URL.revokeObjectURL(prev[i]);
      return next;
    });
  };

  const canSubmit =
    type && date &&
    (type === 'note' ? note.trim().length > 0 :
     type === 'photo' ? photoFiles.length > 0 : false);

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const m = await createMemento({
        partnershipId,
        authorId,
        type,
        date,
        title: title.trim(),
        note: note.trim(),
        photoFile: photoFiles,
        existing,
        visibleRect,
      });
      onCreated(m);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.title}>
          {!type ? 'Pin a memory'
            : type === 'photo' ? 'Add a photo'
            : 'Write a note'}
        </div>

        {!type && (
          <div className={styles.typeGrid}>
            <button className={styles.typeBtn} onClick={() => setType('photo')}>
              <div className={styles.typeIcon}>📷</div>
              <div className={styles.typeLbl}>Photo</div>
            </button>
            <button className={styles.typeBtn} onClick={() => setType('note')}>
              <div className={styles.typeIcon}>✏️</div>
              <div className={styles.typeLbl}>Note</div>
            </button>
          </div>
        )}

        {type && (
          <>
            <button className={styles.back} onClick={() => setType(null)}>← change type</button>

            {type === 'photo' && (
              <div className={styles.field}>
                <label className={styles.label}>
                  Photos {photoFiles.length > 1 && <span className={styles.optional}>{photoFiles.length} in stack</span>}
                </label>
                {photoPreviews.length === 0 ? (
                  <div className={styles.upload} onClick={() => fileRef.current?.click()}>
                    <div className={styles.uploadIcon}>📷</div>
                    <div className={styles.uploadHint}>Tap to choose photos</div>
                  </div>
                ) : (
                  <div className={styles.previewStrip}>
                    {photoPreviews.map((src, i) => (
                      <div key={src} className={styles.previewItem}>
                        <img src={src} alt="" />
                        <button
                          type="button"
                          className={styles.previewRemove}
                          onClick={() => removePhoto(i)}
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
            )}

            {type === 'note' && (
              <div className={styles.field}>
                <label className={styles.label}>Note</label>
                <textarea
                  className={styles.input}
                  placeholder="Write something…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                />
              </div>
            )}

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
                Title <span className={styles.optional}>optional</span>
              </label>
              <input
                className={styles.input}
                placeholder="e.g. First morning in Istanbul"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {type !== 'note' && (
              <div className={styles.field}>
                <label className={styles.label}>
                  Note <span className={styles.optional}>optional</span>
                </label>
                <textarea
                  className={styles.input}
                  placeholder="The story behind it…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {error && <div className={styles.error}>{error}</div>}

            <button className={styles.submit} disabled={!canSubmit || busy} onClick={submit}>
              {busy ? 'Pinning…' : 'Pin to Board →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
