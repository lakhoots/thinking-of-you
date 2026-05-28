import styles from './FavoriteCard.module.css';

function relativeWhen(iso) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = Math.max(0, now - then);
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffH < 24) return `${diffH} hr ago`;
  if (diffD < 7) return `${diffD} day${diffD === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function FavoriteCard({ favorite, author, isMine }) {
  const displayName = isMine ? 'You' : (author?.name || 'Someone');
  const accent = author?.accent_color || '#9C5E4A';
  const initial = (author?.name?.[0] || '?').toUpperCase();

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
        <div className={styles.name}>{displayName}</div>
        <div className={styles.when}>since {relativeWhen(favorite.created_at)}</div>
      </header>

      <p className={styles.prompt}>right now, my favorite thing about you is</p>
      <p className={styles.body}>{favorite.body}</p>
    </article>
  );
}
