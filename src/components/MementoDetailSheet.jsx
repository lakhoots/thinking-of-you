import { useEffect, useRef, useState } from 'react';
import { fmtDate } from '../lib/format';
import { updateMemento } from '../lib/mementos';
import { deleteSticker } from '../lib/stickers';
import { colorForUser } from '../lib/partnerColors';
import { FEATURE_STICKERS } from '../lib/flags';
import PhotoLightbox from './PhotoLightbox';
import { fallbackToFull } from '../lib/thumbFallback';
import styles from './MementoDetailSheet.module.css';

export default function MementoDetailSheet({
  memento,
  author,
  partners,
  currentUserId,
  partnershipId,
  onClose,
  onSaved,
  onStickersChanged,
  onDeleteRequested,
}) {
  const carouselRef = useRef(null);
  const fileRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');
  const [keepPhotos, setKeepPhotos] = useState([]);
  const [newPhotoFiles, setNewPhotoFiles] = useState([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lightboxIdx, setLightboxIdx] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !editing) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editing]);

  // Revoke object URLs for new-photo previews when they're discarded.
  useEffect(() => {
    return () => {
      newPhotoPreviews.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [newPhotoPreviews]);

  if (!memento) return null;

  const { type, image_url, title, note, emoji, date } = memento;
  const photos = memento.photos?.length
    ? memento.photos
    : image_url
      ? [{ id: 'cover', image_url, thumb_url: memento.thumb_url, position: 0 }]
      : [];
  const authorName = author?.name || '';
  const authorColor = author?.accent_color || '#9C5E4A';
  const isAuthor = currentUserId && memento.author_id === currentUserId;

  const onCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== activeIdx) setActiveIdx(idx);
  };

  const goToPhoto = (idx) => {
    const el = carouselRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(photos.length - 1, idx));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
  };

  const startEdit = () => {
    setEditTitle(title || '');
    setEditNote(note || '');
    setEditDate(date || '');
    setKeepPhotos(photos.filter((p) => p.id !== 'cover'));
    setNewPhotoFiles([]);
    setNewPhotoPreviews([]);
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    newPhotoPreviews.forEach((u) => URL.revokeObjectURL(u));
    setNewPhotoFiles([]);
    setNewPhotoPreviews([]);
    setEditing(false);
  };

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

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const patch = {
        title: editTitle.trim() || null,
        note: editNote.trim() || null,
        date: editDate,
      };
      const passPhotos = type === 'photo';
      const result = await updateMemento({
        mementoId: memento.id,
        partnershipId,
        patch,
        keepPhotoIds: passPhotos ? keepPhotos.map((p) => p.id) : undefined,
        newPhotoFiles: passPhotos ? newPhotoFiles : undefined,
      });
      onSaved?.(result);
      newPhotoPreviews.forEach((u) => URL.revokeObjectURL(u));
      setNewPhotoFiles([]);
      setNewPhotoPreviews([]);
      setEditing(false);
    } catch (err) {
      setError(err.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  const onDeleteClick = () => {
    if (!isAuthor) return;
    onDeleteRequested?.(memento.id);
    // Parent will manage the undo window. We close the sheet so the user
    // can see the snackbar and the board layout without the modal.
    onClose();
  };

  const peelSticker = async (id) => {
    try {
      await deleteSticker(id);
      onStickersChanged?.((memento.stickers ?? []).filter((s) => s.id !== id));
    } catch (err) {
      console.error('peel sticker', err);
    }
  };

  return (
    <div className={styles.overlay} onClick={editing ? undefined : onClose}>
      <button
        className={styles.close}
        onClick={(e) => {
          e.stopPropagation();
          if (editing) cancelEdit();
          else onClose();
        }}
        aria-label={editing ? 'Cancel edit' : 'Close'}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 6l12 12M18 6l-12 12" />
        </svg>
      </button>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>

        {type === 'photo' && !editing && photos.length > 0 && (
          <>
            <div className={styles.carouselWrap}>
              <div
                ref={carouselRef}
                className={styles.carousel}
                onScroll={onCarouselScroll}
              >
                {photos.map((p, i) => (
                  <div key={p.id} className={styles.slide}>
                    <button
                      type="button"
                      className={styles.photoButton}
                      onClick={() => setLightboxIdx(i)}
                      aria-label="View photo larger"
                    >
                      <img src={p.image_url} alt="" />
                    </button>
                  </div>
                ))}
              </div>
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    className={`${styles.navArrow} ${styles.navPrev}`}
                    onClick={() => goToPhoto(activeIdx - 1)}
                    disabled={activeIdx === 0}
                    aria-label="Previous photo"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 6l-6 6 6 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`${styles.navArrow} ${styles.navNext}`}
                    onClick={() => goToPhoto(activeIdx + 1)}
                    disabled={activeIdx === photos.length - 1}
                    aria-label="Next photo"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            {photos.length > 1 && (
              <div className={styles.pips}>
                {photos.map((p, i) => (
                  <span
                    key={p.id}
                    className={`${styles.pip} ${i === activeIdx ? styles.pipActive : ''}`}
                  />
                ))}
                <span className={styles.pipCount}>{activeIdx + 1} / {photos.length}</span>
              </div>
            )}
          </>
        )}

        {type === 'photo' && editing && (
          <div className={styles.editPhotos}>
            {keepPhotos.map((p) => (
              <div key={p.id} className={styles.editPhotoItem}>
                <img src={p.thumb_url || p.image_url} alt="" onError={fallbackToFull(p.image_url)} />
                <button
                  type="button"
                  className={styles.editPhotoRemove}
                  onClick={() => removeKeptPhoto(p.id)}
                  aria-label="Remove photo"
                >×</button>
              </div>
            ))}
            {newPhotoPreviews.map((src, i) => (
              <div key={src} className={styles.editPhotoItem}>
                <img src={src} alt="" />
                <button
                  type="button"
                  className={styles.editPhotoRemove}
                  onClick={() => removeNewPhoto(i)}
                  aria-label="Remove photo"
                >×</button>
              </div>
            ))}
            <button
              type="button"
              className={styles.editPhotoAdd}
              onClick={() => fileRef.current?.click()}
              aria-label="Add photo"
            >+</button>
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

        {type === 'emoji' && (
          <div className={styles.emoji}>{emoji}</div>
        )}

        {!editing ? (
          <>
            <div className={styles.meta}>
              {title && <div className={styles.title}>{title}</div>}
              <div className={styles.date}>{fmtDate(date)}</div>
            </div>

            <div className={styles.body}>
              {note ? <p>{note}</p> : <p className={styles.empty}>(no note)</p>}
            </div>
          </>
        ) : (
          <div className={styles.editFields}>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Title</label>
              <input
                className={styles.editInput}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="(optional)"
              />
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Date</label>
              <input
                className={styles.editInput}
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Note</label>
              <textarea
                className={styles.editTextarea}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Write something…"
                rows={5}
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.editActions}>
              <button
                className={styles.deleteBtn}
                onClick={onDeleteClick}
                disabled={saving}
              >
                Remove pin
              </button>
              <div className={styles.editActionsRight}>
                <button className={styles.cancelBtn} onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
                <button className={styles.saveBtn} onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {!editing && FEATURE_STICKERS && (memento.stickers?.length ?? 0) > 0 && (
          <div className={styles.stickersSection}>
            <div className={styles.stickersLabel}>Stickers</div>
            {memento.stickers.map((s) => {
              const sAuthor = (partners ?? []).find((p) => p.id === s.author_id);
              const color = colorForUser(s.author_id, partners);
              return (
                <div key={s.id} className={styles.stickerRow}>
                  <span className={styles.stickerEmoji}>{s.emoji}</span>
                  <div className={styles.stickerInfo}>
                    {s.caption && (
                      <div className={styles.stickerCaption} style={{ color }}>
                        {s.caption}
                      </div>
                    )}
                    <div className={styles.stickerMeta}>
                      {sAuthor?.name ? `${sAuthor.name} · ` : ''}
                      {fmtDate(s.created_at?.slice(0, 10))}
                    </div>
                  </div>
                  {currentUserId === s.author_id && (
                    <button
                      type="button"
                      className={styles.stickerPeel}
                      onClick={() => peelSticker(s.id)}
                    >
                      Peel off
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!editing && (
          <div className={styles.footer}>
            <div className={styles.authorBlock}>
              <div className={styles.authorPip} style={{ background: authorColor }} />
              <div className={styles.authorName}>added by {authorName}</div>
            </div>
            {isAuthor && (
              <button className={styles.editBtn} onClick={startEdit}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                </svg>
                <span>Edit</span>
              </button>
            )}
          </div>
        )}
      </div>
      {lightboxIdx !== null && (
        <PhotoLightbox
          photos={photos}
          initialIndex={lightboxIdx}
          label="Board photo"
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}
