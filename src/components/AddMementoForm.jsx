import { useRef, useState } from 'react';
import { createMemento } from '../lib/mementos';
import { todayStr } from '../lib/format';
import styles from './AddMementoForm.module.css';

const EMOJIS = [
  '🌸','🌿','🌊','🏔️','☕','🍜','🌅','🎵','📸','✈️','🌙','⭐','🌻','🍃',
  '🏙️','🌋','🍣','🥂','🌈','🎞️','💌','🗺️','🌺','🌾','🌐','🕯️','🎭','🧭',
];

export default function AddMementoForm({ partnershipId, authorId, existing, onCreated, onClose }) {
  const [type, setType] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [emoji, setEmoji] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const canSubmit =
    type && date &&
    (type === 'note' ? note.trim().length > 0 :
     type === 'emoji' ? !!emoji :
     type === 'photo' ? !!photoFile : false);

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
        emoji,
        photoFile,
        existing,
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
            : type === 'note' ? 'Write a note'
            : 'Add an emoji'}
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
            <button className={styles.typeBtn} onClick={() => setType('emoji')}>
              <div className={styles.typeIcon}>✨</div>
              <div className={styles.typeLbl}>Emoji</div>
            </button>
          </div>
        )}

        {type && (
          <>
            <button className={styles.back} onClick={() => setType(null)}>← change type</button>

            {type === 'photo' && (
              <div className={styles.field}>
                <label className={styles.label}>Photo</label>
                <div className={styles.upload} onClick={() => fileRef.current?.click()}>
                  {photoPreview ? <img src={photoPreview} alt="" /> : (
                    <>
                      <div className={styles.uploadIcon}>📷</div>
                      <div className={styles.uploadHint}>Tap to choose photo</div>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} />
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

            {type === 'emoji' && (
              <div className={styles.field}>
                <label className={styles.label}>Pick an emoji</label>
                <div className={styles.emojiGrid}>
                  {EMOJIS.map((em) => (
                    <button
                      key={em}
                      className={`${styles.emojiOpt} ${emoji === em ? styles.emojiOn : ''}`}
                      onClick={() => setEmoji(em)}
                    >
                      {em}
                    </button>
                  ))}
                </div>
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
