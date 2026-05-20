import styles from './Sparks.module.css';

export default function Sparks({ currentUserProfile, onOpenSettings }) {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Sparks</div>
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
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>Sparks are coming.</div>
        <div className={styles.emptySub}>
          A quick feed for everyday moments — coming once the Board feels right.
        </div>
      </div>
    </div>
  );
}
