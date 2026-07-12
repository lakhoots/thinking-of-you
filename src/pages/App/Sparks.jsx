import { useCallback, useEffect, useMemo, useState } from 'react';
import SparkCard from '../../components/SparkCard';
import AddSparkForm from '../../components/AddSparkForm';
import SparksSky from '../../components/SparksSky';
import { deleteSpark } from '../../lib/sparks';
import { fmtDate, todayStr } from '../../lib/format';
import { FEATURE_SKY } from '../../lib/flags';
import styles from './Sparks.module.css';

function groupByDate(sparks) {
  const groups = new Map();
  for (const s of sparks) {
    const key = s.date || s.created_at.slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
}

function labelForDate(d) {
  if (d === todayStr()) return 'Today';
  return fmtDate(d);
}

export default function Sparks({
  sparks,
  partners,
  currentUserProfile,
  onOpenSettings,
  onSparkUpdated,
  onSparkCommentAdded,
  onSparkSeen,
  onSparkRemoved,
  onSparkRestored,
  onEditOpenChange,
}) {
  const [editingId, setEditingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [showSky, setShowSky] = useState(false);
  // Spark to scroll to + briefly spotlight after arriving from the sky.
  const [spotlitId, setSpotlitId] = useState(null);

  const currentUserId = currentUserProfile?.id;
  const partnershipId = currentUserProfile?.partnership_id;

  useEffect(() => {
    onEditOpenChange?.(!!editingId);
  }, [editingId, onEditOpenChange]);

  // "See it in the feed": once the sky closes, scroll the spark into view
  // and let the spotlight fade.
  useEffect(() => {
    if (!spotlitId || showSky) return;
    const frame = requestAnimationFrame(() => {
      document
        .querySelector(`[data-spark-id="${spotlitId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const timer = setTimeout(() => setSpotlitId(null), 2000);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [spotlitId, showSky]);

  const visibleSparks = useMemo(
    () => (pendingDelete ? sparks.filter((s) => s.id !== pendingDelete.spark.id) : sparks),
    [sparks, pendingDelete],
  );

  const grouped = useMemo(() => groupByDate(visibleSparks), [visibleSparks]);
  const partnersById = useMemo(() => {
    const m = new Map();
    for (const p of partners ?? []) m.set(p.id, p);
    if (currentUserProfile) m.set(currentUserProfile.id, currentUserProfile);
    return m;
  }, [partners, currentUserProfile]);

  const allProfiles = useMemo(
    () => Array.from(partnersById.values()),
    [partnersById],
  );

  const editingSpark = editingId ? sparks.find((s) => s.id === editingId) : null;

  const requestDelete = useCallback((id) => {
    const s = sparks.find((x) => x.id === id);
    if (!s) return;
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer);
      deleteSpark(pendingDelete.spark.id).catch((err) =>
        console.error('deferred spark delete', err),
      );
    }
    onSparkRemoved?.(id);
    setEditingId(null);
    const timer = setTimeout(async () => {
      try {
        await deleteSpark(id);
      } catch (err) {
        console.error('delete spark', err);
        onSparkRestored?.(s);
      } finally {
        setPendingDelete((curr) => (curr?.spark.id === id ? null : curr));
      }
    }, 5000);
    setPendingDelete({ spark: s, timer });
  }, [sparks, pendingDelete, onSparkRemoved, onSparkRestored]);

  const undoDelete = useCallback(() => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    onSparkRestored?.(pendingDelete.spark);
    setPendingDelete(null);
  }, [pendingDelete, onSparkRestored]);

  useEffect(() => {
    return () => {
      if (pendingDelete) {
        clearTimeout(pendingDelete.timer);
        deleteSpark(pendingDelete.spark.id).catch((err) =>
          console.error('unmount spark delete', err),
        );
      }
    };
  }, [pendingDelete]);

  if (showSky) {
    return (
      <SparksSky
        sparks={sparks}
        profiles={allProfiles}
        onClose={() => setShowSky(false)}
        onOpenSpark={(id) => {
          setSpotlitId(id);
          setShowSky(false);
        }}
      />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Sparks</div>
        <div className={styles.headerRight}>
          {FEATURE_SKY && (
            <button
              className={styles.skyBtn}
              onClick={() => setShowSky(true)}
              aria-label="Open the sky"
              title="The sky"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z" />
                <path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
                <path d="M5 16l.6 1.5 1.5.6-1.5.6L5 20.2l-.6-1.5-1.5-.6 1.5-.6L5 16z" />
              </svg>
            </button>
          )}
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
      </div>

      {visibleSparks.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>Nothing yet.</div>
          <div className={styles.emptySub}>
            Something will catch your eye today.
          </div>
        </div>
      ) : (
        <div className={styles.feed} data-sparks-feed>
          {grouped.map(([date, items]) => (
            <section key={date} className={styles.group}>
              <div className={styles.dateLabel}>{labelForDate(date)}</div>
              <div className={styles.cards}>
                {items.map((s) => (
                  <div
                    key={s.id}
                    data-spark-id={s.id}
                    className={spotlitId === s.id ? styles.spotlit : undefined}
                  >
                    <SparkCard
                      spark={s}
                      author={partnersById.get(s.author_id)}
                      partnersById={partnersById}
                      isAuthor={s.author_id === currentUserId}
                      currentUserId={currentUserId}
                      onEdit={(sp) => setEditingId(sp.id)}
                      onCommentAdded={onSparkCommentAdded}
                      onSeen={onSparkSeen}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {editingSpark && (
        <AddSparkForm
          partnershipId={partnershipId}
          authorId={currentUserId}
          spark={editingSpark}
          onUpdated={(s) => {
            onSparkUpdated?.(s);
            setEditingId(null);
          }}
          onDeleteRequested={(id) => requestDelete(id)}
          onClose={() => setEditingId(null)}
        />
      )}

      {pendingDelete && (
        <div className={styles.undoBar} role="status">
          <span>Spark removed</span>
          <button onClick={undoDelete}>Undo</button>
        </div>
      )}
    </div>
  );
}
