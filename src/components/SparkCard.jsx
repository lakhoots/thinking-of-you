import { useEffect, useMemo, useRef, useState } from 'react';
import { createSparkComment, markSparkSeen } from '../lib/sparks';
import styles from './SparkCard.module.css';

function fmtTime(iso) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const am = h < 12;
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${am ? 'AM' : 'PM'}`;
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export default function SparkCard({
  spark,
  author,
  partnersById,
  isAuthor,
  currentUserId,
  onEdit,
  onCommentAdded,
  onSeen,
}) {
  const name = author?.name || 'Someone';
  const accent = author?.accent_color || '#9C5E4A';
  const initial = (name[0] || '?').toUpperCase();

  // Use the photo stack if present, otherwise fall back to the cover URL
  // for legacy sparks created before spark_photos existed.
  const photos = spark.photos?.length
    ? spark.photos
    : (spark.image_url ? [{ id: 'cover', image_url: spark.image_url, position: 0 }] : []);

  const carouselRef = useRef(null);
  const cardRef = useRef(null);
  const commentInputRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [comment, setComment] = useState('');
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState(null);
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [seenBusy, setSeenBusy] = useState(false);
  const gestureRef = useRef(null);
  const lightboxImageRef = useRef(null);
  const lightboxTransformRef = useRef({ scale: 1, x: 0, y: 0 });
  const lightboxRafRef = useRef(null);

  const seenByMe = !!spark.views?.some((v) => v.user_id === currentUserId);
  const seenByOthers = useMemo(
    () => (spark.views ?? []).filter((v) => v.user_id !== currentUserId),
    [spark.views, currentUserId],
  );

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

  const submitComment = async (e) => {
    e.preventDefault();
    const body = comment.trim();
    if (!body || commentBusy) return;
    setCommentBusy(true);
    setCommentError(null);
    try {
      const created = await createSparkComment({
        sparkId: spark.id,
        authorId: currentUserId,
        body,
      });
      onCommentAdded?.(spark.id, created);
      setComment('');
      setCommentsOpen(true);
    } catch (err) {
      setCommentError(err.message);
    } finally {
      setCommentBusy(false);
    }
  };

  const comments = spark.comments ?? [];
  const commentCountLabel = comments.length === 1 ? '1 comment' : `${comments.length} comments`;

  const toggleComments = () => {
    setCommentsOpen((open) => {
      const next = !open;
      if (!open) {
        window.requestAnimationFrame(() => commentInputRef.current?.focus());
      }
      return next;
    });
  };

  const applyLightboxTransform = () => {
    lightboxRafRef.current = null;
    const img = lightboxImageRef.current;
    if (!img) return;
    const { scale, x, y } = lightboxTransformRef.current;
    img.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  };

  const setLightboxTransformFast = (next) => {
    lightboxTransformRef.current = next;
    if (lightboxRafRef.current) return;
    lightboxRafRef.current = requestAnimationFrame(applyLightboxTransform);
  };

  const resetLightboxTransform = () => {
    if (lightboxRafRef.current) {
      cancelAnimationFrame(lightboxRafRef.current);
      lightboxRafRef.current = null;
    }
    lightboxTransformRef.current = { scale: 1, x: 0, y: 0 };
    const img = lightboxImageRef.current;
    if (img) img.style.transform = 'translate3d(0px, 0px, 0) scale(1)';
  };

  const openLightbox = (idx) => {
    gestureRef.current = null;
    resetLightboxTransform();
    setLightboxIdx(idx);
  };

  const closeLightbox = () => {
    gestureRef.current = null;
    resetLightboxTransform();
    setLightboxIdx(null);
  };

  const lightboxTouchStart = (e) => {
    const transform = lightboxTransformRef.current;
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      gestureRef.current = {
        type: 'pinch',
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        scale: transform.scale,
        x: transform.x,
        y: transform.y,
      };
    } else if (e.touches.length === 1 && transform.scale > 1) {
      const t = e.touches[0];
      gestureRef.current = {
        type: 'pan',
        startX: t.clientX,
        startY: t.clientY,
        scale: transform.scale,
        x: transform.x,
        y: transform.y,
      };
    }
  };

  const lightboxTouchMove = (e) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    e.preventDefault();
    if (gesture.type === 'pinch' && e.touches.length === 2) {
      const [a, b] = e.touches;
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const scale = Math.min(4, Math.max(1, gesture.scale * (distance / gesture.distance)));
      setLightboxTransformFast({
        scale,
        x: scale === 1 ? 0 : gesture.x,
        y: scale === 1 ? 0 : gesture.y,
      });
    } else if (gesture.type === 'pan' && e.touches.length === 1) {
      const t = e.touches[0];
      const limit = 160 * gesture.scale;
      setLightboxTransformFast({
        scale: gesture.scale,
        x: Math.max(-limit, Math.min(limit, gesture.x + t.clientX - gesture.startX)),
        y: Math.max(-limit, Math.min(limit, gesture.y + t.clientY - gesture.startY)),
      });
    }
  };

  const lightboxTouchEnd = () => {
    gestureRef.current = null;
    const curr = lightboxTransformRef.current;
    if (curr.scale <= 1.03) resetLightboxTransform();
  };

  useEffect(() => {
    if (!currentUserId || currentUserId === spark.author_id || seenByMe || seenBusy) return;
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting || entry.intersectionRatio < 0.6) return;
      observer.disconnect();
      setSeenBusy(true);
      markSparkSeen({ sparkId: spark.id, userId: currentUserId })
        .then((view) => onSeen?.(spark.id, view))
        .catch((err) => {
          if (!err.message?.includes('spark_views')) {
            console.error('mark spark seen', err);
          }
        })
        .finally(() => setSeenBusy(false));
    }, { threshold: [0.6] });
    observer.observe(el);
    return () => observer.disconnect();
  }, [currentUserId, onSeen, seenBusy, seenByMe, spark.author_id, spark.id]);

  return (
    <article ref={cardRef} className={styles.card}>
      <header className={styles.head}>
        <div
          className={styles.avatar}
          style={{ background: accent }}
          aria-hidden
        >
          {author?.photo_url
            ? <img src={author.photo_url} alt="" />
            : initial}
        </div>
        <div className={styles.name}>{name}</div>
        <div className={styles.time}>{fmtTime(spark.created_at)}</div>
      </header>

      {spark.note && <p className={styles.note}>{spark.note}</p>}

      {photos.length === 1 && (
        <div className={styles.photoWrap}>
          <button
            type="button"
            className={styles.photoButton}
            onClick={() => openLightbox(0)}
            aria-label="View photo larger"
          >
            <img className={styles.photo} src={photos[0].image_url} alt="" />
          </button>
        </div>
      )}

      {photos.length > 1 && (
        <div className={styles.carouselWrap}>
          <div className={styles.carouselFrame}>
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
                    onClick={() => openLightbox(i)}
                    aria-label="View photo larger"
                  >
                    <img src={p.image_url} alt="" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className={`${styles.navArrow} ${styles.navPrev}`}
              onClick={() => goToPhoto(activeIdx - 1)}
              disabled={activeIdx === 0}
              aria-label="Previous photo"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
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
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
          <div className={styles.pips}>
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`${styles.pip} ${i === activeIdx ? styles.pipActive : ''}`}
                onClick={() => goToPhoto(i)}
                aria-label={`Photo ${i + 1} of ${photos.length}`}
              />
            ))}
          </div>
        </div>
      )}

      {isAuthor && (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.editBtn}
            onClick={() => onEdit?.(spark)}
          >
            Edit
          </button>
        </div>
      )}

      <div className={`${styles.comments} ${commentsOpen ? styles.commentsOpen : ''}`}>
        <div className={styles.commentActionRow}>
          <button
            type="button"
            className={styles.commentToggle}
            onClick={toggleComments}
            aria-expanded={commentsOpen}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
            </svg>
            <span>{comments.length > 0 ? commentCountLabel : 'Comment'}</span>
          </button>

          {seenByOthers.length > 0 && (
            <div className={styles.seenBy}>
              Seen by {seenByOthers.map((v) => {
                const viewer = partnersById?.get(v.user_id);
                return viewer?.name || 'Someone';
              }).join(', ')}
            </div>
          )}
        </div>

        {commentsOpen && (
          <div className={styles.commentPanel}>
            {comments.length > 0 && (
              <div className={styles.commentList}>
                {comments.map((c) => {
                  const commenter = partnersById?.get(c.author_id);
                  return (
                    <div key={c.id} className={styles.comment}>
                      <div
                        className={styles.commentAvatar}
                        style={{ background: commenter?.accent_color || '#9C5E4A' }}
                        aria-hidden
                      >
                        {commenter?.photo_url
                          ? <img src={commenter.photo_url} alt="" />
                          : (commenter?.name?.[0] || '?').toUpperCase()}
                      </div>
                      <div className={styles.commentBubble}>
                        <div className={styles.commentMeta}>
                          <span>{commenter?.name || 'Someone'}</span>
                          <time dateTime={c.created_at}>{fmtDateTime(c.created_at)}</time>
                        </div>
                        <div className={styles.commentBody}>{c.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <form className={styles.commentForm} onSubmit={submitComment}>
              <input
                ref={commentInputRef}
                className={styles.commentInput}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Leave a comment…"
                aria-label="Leave a comment"
              />
              <button
                type="submit"
                className={styles.commentSubmit}
                disabled={!comment.trim() || commentBusy}
              >
                {commentBusy ? '…' : 'Send'}
              </button>
            </form>
            {commentError && <div className={styles.commentError}>{commentError}</div>}
          </div>
        )}
      </div>

      {lightboxIdx !== null && (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Spark photo"
          onClick={closeLightbox}
          onTouchStart={lightboxTouchStart}
          onTouchMove={lightboxTouchMove}
          onTouchEnd={lightboxTouchEnd}
        >
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={closeLightbox}
            aria-label="Close photo"
          >
            ×
          </button>
          <img
            ref={lightboxImageRef}
            className={styles.lightboxImage}
            src={photos[lightboxIdx]?.image_url}
            alt=""
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </article>
  );
}
