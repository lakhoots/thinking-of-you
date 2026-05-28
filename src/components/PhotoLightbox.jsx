import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './PhotoLightbox.module.css';

export default function PhotoLightbox({
  photos,
  initialIndex = 0,
  label = 'Photo',
  onClose,
}) {
  const [activeIdx, setActiveIdx] = useState(() =>
    Math.max(0, Math.min(photos.length - 1, initialIndex)),
  );
  const imageRef = useRef(null);
  const gestureRef = useRef(null);
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const rafRef = useRef(null);
  const pointerStartRef = useRef(null);
  const hasMany = photos.length > 1;

  const applyTransform = () => {
    rafRef.current = null;
    const img = imageRef.current;
    if (!img) return;
    const { scale, x, y } = transformRef.current;
    img.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  };

  const setTransformFast = (next) => {
    transformRef.current = next;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(applyTransform);
  };

  const resetTransform = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    transformRef.current = { scale: 1, x: 0, y: 0 };
    const img = imageRef.current;
    if (img) img.style.transform = 'translate3d(0px, 0px, 0) scale(1)';
  }, []);

  const goToPhoto = useCallback((idx) => {
    const clamped = Math.max(0, Math.min(photos.length - 1, idx));
    resetTransform();
    setActiveIdx(clamped);
  }, [photos.length, resetTransform]);

  const goPrev = () => goToPhoto(activeIdx - 1);
  const goNext = () => goToPhoto(activeIdx + 1);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && activeIdx > 0) goToPhoto(activeIdx - 1);
      if (e.key === 'ArrowRight' && activeIdx < photos.length - 1) goToPhoto(activeIdx + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIdx, goToPhoto, onClose, photos.length]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const onTouchStart = (e) => {
    const transform = transformRef.current;
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pointerStartRef.current = null;
      gestureRef.current = {
        type: 'pinch',
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        scale: transform.scale,
        x: transform.x,
        y: transform.y,
      };
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      pointerStartRef.current = { x: t.clientX, y: t.clientY };
      if (transform.scale > 1) {
        gestureRef.current = {
          type: 'pan',
          startX: t.clientX,
          startY: t.clientY,
          scale: transform.scale,
          x: transform.x,
          y: transform.y,
        };
      } else {
        gestureRef.current = null;
      }
    }
  };

  const onTouchMove = (e) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    e.preventDefault();
    if (gesture.type === 'pinch' && e.touches.length === 2) {
      const [a, b] = e.touches;
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const scale = Math.min(4, Math.max(1, gesture.scale * (distance / gesture.distance)));
      setTransformFast({
        scale,
        x: scale === 1 ? 0 : gesture.x,
        y: scale === 1 ? 0 : gesture.y,
      });
    } else if (gesture.type === 'pan' && e.touches.length === 1) {
      const t = e.touches[0];
      const limit = 160 * gesture.scale;
      setTransformFast({
        scale: gesture.scale,
        x: Math.max(-limit, Math.min(limit, gesture.x + t.clientX - gesture.startX)),
        y: Math.max(-limit, Math.min(limit, gesture.y + t.clientY - gesture.startY)),
      });
    }
  };

  const onTouchEnd = (e) => {
    const curr = transformRef.current;
    const start = pointerStartRef.current;
    gestureRef.current = null;
    if (curr.scale <= 1.03) resetTransform();

    if (!start || e.changedTouches.length !== 1 || curr.scale > 1.03) {
      pointerStartRef.current = null;
      return;
    }

    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    pointerStartRef.current = null;
    if (Math.abs(dx) < 54 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    if (dx < 0 && activeIdx < photos.length - 1) goNext();
    if (dx > 0 && activeIdx > 0) goPrev();
  };

  if (!photos.length) return null;

  return (
    <div
      className={styles.lightbox}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <button
        type="button"
        className={styles.close}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close photo"
      >
        ×
      </button>

      {hasMany && (
        <button
          type="button"
          className={`${styles.navArrow} ${styles.navPrev}`}
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          disabled={activeIdx === 0}
          aria-label="Previous photo"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      )}

      <img
        ref={imageRef}
        key={photos[activeIdx]?.id ?? photos[activeIdx]?.image_url}
        className={styles.image}
        src={photos[activeIdx]?.image_url}
        alt=""
        onClick={(e) => e.stopPropagation()}
      />

      {hasMany && (
        <>
          <button
            type="button"
            className={`${styles.navArrow} ${styles.navNext}`}
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            disabled={activeIdx === photos.length - 1}
            aria-label="Next photo"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <div className={styles.pips} onClick={(e) => e.stopPropagation()}>
            {photos.map((p, i) => (
              <button
                key={p.id ?? p.image_url}
                type="button"
                className={`${styles.pip} ${i === activeIdx ? styles.pipActive : ''}`}
                onClick={() => goToPhoto(i)}
                aria-label={`Photo ${i + 1} of ${photos.length}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
