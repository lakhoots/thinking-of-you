import { useMemo } from 'react';
import FavoriteCard from '../../components/FavoriteCard';
import cardStyles from '../../components/FavoriteCard.module.css';
import styles from './Favorites.module.css';

// "Current" is just the latest row per author. Older rows are kept in
// the DB for the future replay feature — see src/lib/favorites.js.
function latestFor(favorites, authorId) {
  // favorites is sorted desc by created_at upstream.
  return favorites.find((f) => f.author_id === authorId) || null;
}

function EmptyCard({ author, isMine }) {
  const name = isMine ? 'You' : (author?.name || 'Someone');
  const accent = author?.accent_color || '#9C5E4A';
  const initial = (author?.name?.[0] || '?').toUpperCase();
  const placeholder = isMine
    ? 'nothing from you yet.'
    : `nothing from ${author?.name || 'them'} yet.`;

  return (
    <article className={cardStyles.card}>
      <header className={cardStyles.head}>
        <div
          className={cardStyles.avatar}
          style={{ background: accent, opacity: 0.55 }}
          aria-hidden
        >
          {author?.photo_url
            ? <img src={author.photo_url} alt="" />
            : initial}
        </div>
        <div className={cardStyles.name}>{name}</div>
      </header>
      <p className={cardStyles.prompt}>right now, my favorite thing about you is</p>
      <p className={cardStyles.emptyBody}>{placeholder}</p>
    </article>
  );
}

export default function Favorites({
  favorites,
  partners,
  currentUserProfile,
  onOpenSettings,
}) {
  const currentUserId = currentUserProfile?.id;
  const partner = useMemo(
    () => (partners ?? []).find((p) => p.id !== currentUserId) || null,
    [partners, currentUserId],
  );

  const myCurrent = useMemo(
    () => latestFor(favorites, currentUserId),
    [favorites, currentUserId],
  );
  const partnerCurrent = useMemo(
    () => (partner ? latestFor(favorites, partner.id) : null),
    [favorites, partner],
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Favorites</div>
        <button
          className={styles.meAvatar}
          onClick={onOpenSettings}
          style={{ background: currentUserProfile?.accent_color || '#9C5E4A' }}
          aria-label="Settings"
        >
          {currentUserProfile?.photo_url
            ? <img src={currentUserProfile.photo_url} alt="" />
            : (currentUserProfile?.name?.[0] || '?').toUpperCase()}
        </button>
      </div>

      <div className={styles.body}>
        {partner && (
          partnerCurrent
            ? <FavoriteCard favorite={partnerCurrent} author={partner} />
            : <EmptyCard author={partner} isMine={false} />
        )}

        {myCurrent
          ? <FavoriteCard favorite={myCurrent} author={currentUserProfile} isMine />
          : <EmptyCard author={currentUserProfile} isMine />
        }
      </div>
    </div>
  );
}
