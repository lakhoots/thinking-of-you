import styles from './NavBar.module.css';

export default function NavBar({ tab, onTab, onAdd }) {
  return (
    <div className={styles.nav}>
      <div
        className={`${styles.tab} ${tab === 'sparks' ? styles.on : ''}`}
        onClick={() => onTab('sparks')}
      >
        <div className={styles.icon}>✦</div>
        <span>Sparks</span>
      </div>

      <div style={{ width: 60 }} />

      <div
        className={`${styles.tab} ${tab === 'board' ? styles.on : ''}`}
        onClick={() => onTab('board')}
      >
        <div className={styles.icon}>◫</div>
        <span>The Board</span>
      </div>

      <div className={styles.addWrap}>
        <button className={styles.addBtn} onClick={onAdd} aria-label="Add">+</button>
      </div>
    </div>
  );
}
