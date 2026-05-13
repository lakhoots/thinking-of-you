import styles from './Sparks.module.css';

export default function Sparks() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Sparks</div>
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
