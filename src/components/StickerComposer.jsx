import { useEffect, useRef, useState } from 'react';
import { createSticker, STICKER_CAPTION_MAX } from '../lib/stickers';
import { createMemento } from '../lib/mementos';
import { todayStr } from '../lib/format';
import { STICKERS_DEMO } from '../lib/flags';
import styles from './StickerComposer.module.css';

// Curated, warm, everyday — not a full emoji keyboard.
const CURATED = [
  '🦈', '😈', '💦', '🎵', '♥️', '😘',
  '😍', '🥰', '🥹', '😭', '🤯', '😂',
  '😋', '🧐', '😎', '🤩', '😳', '🤠',
  '💪', '✨', '💫', '✅', '👄', '🍑',
];

const MAX_EMOJI = 3;
// Matches the DB check on the emoji column.
const MAX_EMOJI_CHARS = 16;

export default function StickerComposer({
  memento,
  mementos,
  partnershipId,
  authorId,
  anchorX,
  anchorY,
  onCreated,
  onNoteCreated,
  onClose,
}) {
  const [picked, setPicked] = useState([]);
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // The sheet opens under a still-pressed finger (long-press); ignore the
  // overlay "tap-away" for a beat so the release doesn't instantly close it.
  const tapAwayArmed = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => { tapAwayArmed.current = true; }, 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // iOS scrolls the page to "reveal" the focused caption input even though
  // the sheet already lifts itself above the keyboard via --kb-vh — the two
  // corrections stack and drag every fixed overlay off-screen. The page
  // behind the composer never legitimately scrolls, so while the composer
  // is open, pin the scroll position back to zero whenever it moves.
  useEffect(() => {
    const vv = window.visualViewport;
    const reset = () => {
      const se = document.scrollingElement;
      if (se && se.scrollTop !== 0) se.scrollTop = 0;
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    vv?.addEventListener('resize', reset);
    vv?.addEventListener('scroll', reset);
    window.addEventListener('scroll', reset);
    return () => {
      vv?.removeEventListener('resize', reset);
      vv?.removeEventListener('scroll', reset);
      window.removeEventListener('scroll', reset);
    };
  }, []);

  const overCap = caption.trim().length > STICKER_CAPTION_MAX;
  const emoji = picked.join('');
  const canStick = picked.length > 0 && !overCap && !saving;

  const toggleEmoji = (e) => {
    setPicked((prev) => {
      if (prev.includes(e)) return prev.filter((x) => x !== e);
      if (prev.length >= MAX_EMOJI) return prev;
      if ([...prev, e].join('').length > MAX_EMOJI_CHARS) return prev;
      return [...prev, e];
    });
  };

  const stick = async () => {
    if (!canStick) return;
    setSaving(true);
    setError(null);
    try {
      const sticker = await createSticker({
        mementoId: memento.id,
        authorId,
        emoji,
        caption,
        anchorX,
        anchorY,
      });
      onCreated?.(sticker);
      onClose();
    } catch (err) {
      // Pre-migration state: the stickers table isn't on this database yet.
      const msg = err.message ?? String(err);
      setError(
        msg.includes('stickers') && msg.includes('schema cache')
          ? 'Stickers aren’t set up on the database yet — the migration hasn’t been applied.'
          : msg,
      );
      setSaving(false);
    }
  };

  // The caption outgrew a sticker — it wants to be a real note on the
  // board, pinned near the parent card. The sticker draft is discarded.
  const convertToNote = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const nearParent = {
        minX: Math.max(0, memento.pos_x - 0.07),
        maxX: Math.min(1, memento.pos_x + 0.07),
        minY: Math.max(0, memento.pos_y - 0.06),
        maxY: Math.min(1, memento.pos_y + 0.06),
      };
      const note = await createMemento({
        partnershipId,
        authorId,
        type: 'note',
        date: todayStr(),
        note: caption.trim(),
        existing: mementos,
        visibleRect: nearParent,
      });
      onNoteCreated?.(note);
      onClose();
    } catch (err) {
      setError(err.message ?? String(err));
      setSaving(false);
    }
  };

  const overlayClick = () => {
    if (!tapAwayArmed.current) return;
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={overlayClick}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.title}>Stick something on it</div>
        {STICKERS_DEMO && (
          <div className={styles.demoHint}>
            Preview mode — stickers stay in this browser, only you see them.
          </div>
        )}

        {/* The grid is the one part that shrinks and scrolls when the
            keyboard halves the sheet — caption and actions stay whole. */}
        <div className={styles.gridScroll}>
          <div className={styles.grid}>
            {CURATED.map((e) => (
              <button
                key={e}
                type="button"
                className={`${styles.emojiBtn} ${picked.includes(e) ? styles.on : ''}`}
                onClick={() => toggleEmoji(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.captionRow}>
          <input
            className={`${styles.captionInput} ${overCap ? styles.overCap : ''}`}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="say a little something (optional)"
            maxLength={240}
          />
          <span className={`${styles.counter} ${overCap ? styles.counterOver : ''}`}>
            {caption.trim().length}/{STICKER_CAPTION_MAX}
          </span>
        </div>

        {overCap && (
          <button
            type="button"
            className={styles.convert}
            onClick={convertToNote}
            disabled={saving || STICKERS_DEMO}
          >
            {STICKERS_DEMO
              ? 'That’s more than a sticker — it would offer to become a real note.'
              : 'That’s more than a sticker — turn it into a note?'}
          </button>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose} disabled={saving}>
            Never mind
          </button>
          <button type="button" className={styles.stick} onClick={stick} disabled={!canStick}>
            {saving ? 'Sticking…' : `Stick it${emoji ? ` ${emoji}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
