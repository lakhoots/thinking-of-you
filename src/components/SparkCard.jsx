import { useRef, useState } from 'react';
import { createSparkComment } from '../lib/sparks';
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

export default function SparkCard({
  spark,
  author,
  partnersById,
  isAuthor,
  currentUserId,
  onEdit,
  onCommentAdded,
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
  const [activeIdx, setActiveIdx] = useState(0);
  const [comment, setComment] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState(null);

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
    } catch (err) {
      setCommentError(err.message);
    } finally {
      setCommentBusy(false);
    }
  };

  const comments = spark.comments ?? [];

  return (
    <article className={styles.card}>
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
          <img className={styles.photo} src={photos[0].image_url} alt="" />
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
              {photos.map((p) => (
                <div key={p.id} className={styles.slide}>
                  <img src={p.image_url} alt="" />
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

      <div className={styles.comments}>
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
                      {commenter?.name || 'Someone'}
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
    </article>
  );
}
