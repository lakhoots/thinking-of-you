import { useCallback, useEffect, useMemo, useState } from 'react';
import FavoriteCard from '../../components/FavoriteCard';
import AddFavoriteForm from '../../components/AddFavoriteForm';
import { deleteFavorite } from '../../lib/favorites';
import { fmtDate, todayStr } from '../../lib/format';
import styles from './Favorites.module.css';

function groupByDate(favorites) {
  const groups = new Map();
  for (const f of favorites) {
    const key = f.date || f.created_at.slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
}

function labelForDate(d) {
  if (d === todayStr()) return 'Today';
  return fmtDate(d);
}

export default function Favorites({
  favorites,
  partners,
  currentUserProfile,
  onOpenSettings,
  onFavoriteUpdated,
  onFavoriteRemoved,
  onFavoriteRestored,
  onEditOpenChange,
}) {
  const [editingId, setEditingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const currentUserId = currentUserProfile?.id;
  const partnershipId = currentUserProfile?.partnership_id;

  useEffect(() => {
    onEditOpenChange?.(!!editingId);
  }, [editingId, onEditOpenChange]);

  const visibleFavorites = useMemo(
    () => (pendingDelete ? favorites.filter((f) => f.id !== pendingDelete.favorite.id) : favorites),
    [favorites, pendingDelete],
  );

  const grouped = useMemo(() => groupByDate(visibleFavorites), [visibleFavorites]);

  const partnersById = useMemo(() => {
    const m = new Map();
    for (const p of partners ?? []) m.set(p.id, p);
    if (currentUserProfile) m.set(currentUserProfile.id, currentUserProfile);
    return m;
  }, [partners, currentUserProfile]);

  const editingFavorite = editingId ? favorites.find((f) => f.id === editingId) : null;

  const requestDelete = useCallback((id) => {
    const f = favorites.find((x) => x.id === id);
    if (!f) return;
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer);
      deleteFavorite(pendingDelete.favorite.id).catch((err) =>
        console.error('deferred favorite delete', err),
      );
    }
    onFavoriteRemoved?.(id);
    setEditingId(null);
    const timer = setTimeout(async () => {
      try {
        await deleteFavorite(id);
      } catch (err) {
        console.error('delete favorite', err);
        onFavoriteRestored?.(f);
      } finally {
        setPendingDelete((curr) => (curr?.favorite.id === id ? null : curr));
      }
    }, 5000);
    setPendingDelete({ favorite: f, timer });
  }, [favorites, pendingDelete, onFavoriteRemoved, onFavoriteRestored]);

  const undoDelete = useCallback(() => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    onFavoriteRestored?.(pendingDelete.favorite);
    setPendingDelete(null);
  }, [pendingDelete, onFavoriteRestored]);

  useEffect(() => {
    return () => {
      if (pendingDelete) {
        clearTimeout(pendingDelete.timer);
        deleteFavorite(pendingDelete.favorite.id).catch((err) =>
          console.error('unmount favorite delete', err),
        );
      }
    };
  }, [pendingDelete]);

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

      {visibleFavorites.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>Nothing yet.</div>
          <div className={styles.emptySub}>
            Right now, your favorite thing about them is…
          </div>
        </div>
      ) : (
        <div className={styles.feed}>
          {grouped.map(([date, items]) => (
            <section key={date} className={styles.group}>
              <div className={styles.dateLabel}>{labelForDate(date)}</div>
              <div className={styles.cards}>
                {items.map((f) => (
                  <FavoriteCard
                    key={f.id}
                    favorite={f}
                    author={partnersById.get(f.author_id)}
                    isAuthor={f.author_id === currentUserId}
                    onEdit={(fav) => setEditingId(fav.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {editingFavorite && (
        <AddFavoriteForm
          partnershipId={partnershipId}
          authorId={currentUserId}
          favorite={editingFavorite}
          onUpdated={(f) => {
            onFavoriteUpdated?.(f);
            setEditingId(null);
          }}
          onDeleteRequested={(id) => requestDelete(id)}
          onClose={() => setEditingId(null)}
        />
      )}

      {pendingDelete && (
        <div className={styles.undoBar} role="status">
          <span>Favorite removed</span>
          <button onClick={undoDelete}>Undo</button>
        </div>
      )}
    </div>
  );
}
