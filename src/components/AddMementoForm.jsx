import { useRef, useState } from 'react';
import { createMemento } from '../lib/mementos';
import { todayStr } from '../lib/format';
import { SELECTABLE_THEMES, getListTheme } from '../lib/listThemes';
import styles from './AddMementoForm.module.css';

export default function AddMementoForm({ partnershipId, authorId, existing, onCreated, onClose }) {
  const [type, setType] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  // List-specific state.
  const [listTheme, setListTheme] = useState(null);
  const [items, setItems] = useState([]);
  const [itemDraft, setItemDraft] = useState('');
  const [stickerFile, setStickerFile] = useState(null);
  const [stickerPreview, setStickerPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();
  const stickerRef = useRef();

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

  const onSticker = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (stickerPreview) URL.revokeObjectURL(stickerPreview);
    setStickerFile(f);
    setStickerPreview(URL.createObjectURL(f));
    e.target.value = '';
  };

  const removeSticker = () => {
    if (stickerPreview) URL.revokeObjectURL(stickerPreview);
    setStickerFile(null);
    setStickerPreview(null);
  };

  const addItem = () => {
    const t = itemDraft.trim();
    if (!t) return;
    setItems((prev) => [...prev, t]);
    setItemDraft('');
  };

  const removeItem = (i) => {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  };

  const canSubmit =
    type && date &&
    (type === 'note' ? note.trim().length > 0 :
     type === 'photo' ? photoFiles.length > 0 :
     type === 'list' ? (listTheme && title.trim().length > 0) : false);

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
        photoFile: type === 'list' ? stickerFile : photoFiles,
        listTheme,
        listItems: type === 'list' ? items : undefined,
        existing,
      });
      onCreated(m);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const activeTheme = listTheme ? getListTheme(listTheme) : null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.title}>
          {!type ? 'Pin a memory'
            : type === 'photo' ? 'Add a photo'
            : type === 'list' ? 'New list'
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
            <button className={styles.typeBtn} onClick={() => setType('list')}>
              <div className={styles.typeIcon}>📋</div>
              <div className={styles.typeLbl}>List</div>
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

            {type === 'list' && (
              <>
                <div className={styles.field}>
                  <label className={styles.label}>Theme</label>
                  <div className={styles.themeGrid}>
                    {SELECTABLE_THEMES.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        className={`${styles.themeBtn} ${listTheme === t.key ? styles.themeBtnActive : ''}`}
                        style={listTheme === t.key ? { borderColor: t.accent } : undefined}
                        onClick={() => setListTheme(t.key)}
                      >
                        <span className={styles.themeEmoji}>{t.emoji}</span>
                        <span className={styles.themeLbl}>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>
                    Your own sticker <span className={styles.optional}>optional</span>
                  </label>
                  {stickerPreview ? (
                    <div className={styles.previewStrip}>
                      <div className={styles.previewItem}>
                        <img src={stickerPreview} alt="" />
                        <button
                          type="button"
                          className={styles.previewRemove}
                          onClick={removeSticker}
                          aria-label="Remove image"
                        >×</button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.upload} onClick={() => stickerRef.current?.click()}>
                      <div className={styles.uploadIcon}>🖼️</div>
                      <div className={styles.uploadHint}>
                        Upload an image if no theme fits — a transparent PNG works best
                      </div>
                    </div>
                  )}
                  <input
                    ref={stickerRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={onSticker}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>List name</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. Movies to watch together"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>
                    Starting items <span className={styles.optional}>optional</span>
                  </label>
                  {items.length > 0 && (
                    <div className={styles.itemList}>
                      {items.map((it, i) => (
                        <div key={`${it}-${i}`} className={styles.itemChip}>
                          <span>{it}</span>
                          <button
                            type="button"
                            className={styles.itemChipRemove}
                            onClick={() => removeItem(i)}
                            aria-label="Remove item"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={styles.addItemRow}>
                    <input
                      className={styles.input}
                      placeholder={activeTheme?.itemPlaceholder || 'Add an item…'}
                      value={itemDraft}
                      onChange={(e) => setItemDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); addItem(); }
                      }}
                    />
                    <button
                      type="button"
                      className={styles.addItemBtn}
                      onClick={addItem}
                      disabled={!itemDraft.trim()}
                    >Add</button>
                  </div>
                </div>
              </>
            )}

            {type !== 'list' && (
              <div className={styles.field}>
                <label className={styles.label}>Date</label>
                <input
                  className={styles.input}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            )}

            {type !== 'list' && (
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
            )}

            {type !== 'note' && type !== 'list' && (
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
              {busy ? 'Pinning…' : type === 'list' ? 'Pin list to Board →' : 'Pin to Board →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
