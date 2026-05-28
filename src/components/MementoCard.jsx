import { fmtDate } from '../lib/format';
import { fallbackToFull } from '../lib/thumbFallback';
import styles from './MementoCard.module.css';

const CARD_W = 138;
const CARD_H = 170;

export default function MementoCard({ memento, author, flipped, entering, x, y, rotationOverride, scaleOverride, scaleYOverride, onOpenDetail, arrangeMode, dragging, selected }) {
  const { type, image_url, thumb_url, title, note, emoji, date, rotation: baseRotation, scale: baseScale, scale_y: baseScaleY, has_transparency: hasTransparency } = memento;
  const rotation = rotationOverride ?? baseRotation;
  const scaleX = scaleOverride ?? baseScale ?? 1;
  const scaleY = scaleYOverride ?? baseScaleY ?? 1;
  const isNote = type === 'note';
  // Borderless render: transparent-cover photos shed the cream card frame
  // on the front face only (back stays normal so notes still read).
  const borderless = type === 'photo' && !!hasTransparency;

  // Notes change actual box dimensions so the text reflows and more of it
  // shows when the card grows. Everything else scales uniformly via CSS
  // transform so the photo/emoji and the text scale together.
  const widthPx = isNote ? CARD_W * scaleX : CARD_W;
  const heightPx = isNote ? CARD_H * scaleY : CARD_H;
  const cssTransform = isNote
    ? `rotate(${rotation}deg)`
    : `rotate(${rotation}deg) scale(${scaleX})`;
  const authorName = author?.name || '';
  const authorColor = author?.accent_color || '#9C5E4A';

  // Photos for the back-of-card thumbnail strip. Fall back to image_url
  // for legacy pins that haven't been re-fetched with the join yet.
  const thumbs = memento.photos?.length
    ? memento.photos
    : image_url
      ? [{ id: 'cover', image_url, thumb_url }]
      : [];
  const visibleThumbs = thumbs.slice(0, 4);
  const overflow = Math.max(0, thumbs.length - visibleThumbs.length);

  return (
    <div
      className={`${styles.wrap} ${type === 'photo' ? styles.photoCard : ''} ${arrangeMode ? styles.arranging : ''} ${dragging ? styles.dragging : ''} ${selected ? styles.selected : ''} ${borderless ? styles.borderless : ''}`}
      data-card-id={memento.id}
      style={{
        left: x - widthPx / 2,
        top: y - heightPx / 2,
        width: widthPx,
        height: heightPx,
        transform: cssTransform,
        zIndex: dragging ? 100 : selected ? 60 : flipped ? 50 : 1,
      }}
    >
      {arrangeMode && selected && (
        <div
          className={styles.resizeHandle}
          data-resize-handle={memento.id}
          aria-label="Resize"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12v8h-8M4 12V4h8" />
          </svg>
        </div>
      )}
      <div className={styles.perspective}>
        <div className={`${styles.inner} ${flipped ? styles.flipped : ''}`}>
          <div className={`${styles.face} ${styles.front} ${entering ? styles.entering : ''}`}>
            {type === 'photo' && (
              <>
                <div className={styles.img}>
                  {image_url ? <img src={thumb_url || image_url} alt="" draggable={false} loading="lazy" decoding="async" onError={fallbackToFull(image_url)} /> : <span className={styles.placeholder}>📷</span>}
                </div>
                {!borderless && (
                  <div className={styles.footer}>
                    <span>{title || fmtDate(date)}</span>
                  </div>
                )}
              </>
            )}
            {type === 'note' && (
              <>
                <div className={styles.noteBody}><p>{note || '…'}</p></div>
                <div className={styles.footer}>
                  <span>{title || fmtDate(date)}</span>
                </div>
              </>
            )}
            {type === 'emoji' && (
              <>
                <div className={styles.emojiBody}>{emoji}</div>
                <div className={styles.footer}>
                  <span>{title || fmtDate(date)}</span>
                </div>
              </>
            )}
          </div>

          <div className={`${styles.face} ${styles.back}`}>
            <button
              type="button"
              className={styles.expand}
              aria-label="Open details"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail?.(memento.id);
              }}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 5h6M5 5v6M5 5l7 7" />
                <path d="M19 19h-6M19 19v-6M19 19l-7-7" />
              </svg>
            </button>
            {type === 'photo' && thumbs.length > 0 && (
              <div className={styles.backThumbs}>
                {visibleThumbs.map((p) => (
                  <div key={p.id} className={styles.backThumb}>
                    <img src={p.thumb_url || p.image_url} alt="" draggable={false} loading="lazy" decoding="async" onError={fallbackToFull(p.image_url)} />
                  </div>
                ))}
                {overflow > 0 && (
                  <div className={`${styles.backThumb} ${styles.backThumbMore}`}>
                    +{overflow}
                  </div>
                )}
              </div>
            )}
            <div className={`${styles.backNote} ${!note ? styles.empty : ''}`}>
              {note || '(no note)'}
            </div>
            <div className={styles.backFooter}>
              <div className={styles.backDate}>{fmtDate(date)}</div>
              <div className={styles.backAuthor}>
                <div className={styles.authorPip} style={{ background: authorColor }} />
                <div className={styles.authorName}>{authorName}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { CARD_W, CARD_H };
