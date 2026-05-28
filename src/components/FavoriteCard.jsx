import styles from './FavoriteCard.module.css';

function fmtTime(iso) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const am = h < 12;
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${am ? 'AM' : 'PM'}`;
}

export default function FavoriteCard({ favorite, author, isAuthor, onEdit }) {
  const name = author?.name || 'Someone';
  const accent = author?.accent_color || '#9C5E4A';
  const initial = (name[0] || '?').toUpperCase();

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
        <div className={styles.time}>{fmtTime(favorite.created_at)}</div>
      </header>

      <p className={styles.prompt}>right now, my favorite thing about you is</p>
      <p className={styles.body}>{favorite.body}</p>

      {isAuthor && (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.editBtn}
            onClick={() => onEdit?.(favorite)}
          >
            Edit
          </button>
        </div>
      )}
    </article>
  );
}
