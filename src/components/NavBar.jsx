import styles from './NavBar.module.css';
import { BoardIcon } from './BoardIcon';
import { HeartIcon } from './HeartIcon';

export default function NavBar({ tab, onTab, onAdd }) {
  return (
    <>
      <div className={styles.nav}>
        <div
          className={`${styles.tab} ${tab === 'sparks' ? styles.on : ''}`}
          onClick={() => onTab('sparks')}
        >
          <div className={styles.icon}>✦</div>
          <span>Sparks</span>
        </div>

        <div
          className={`${styles.tab} ${tab === 'favorites' ? styles.on : ''}`}
          onClick={() => onTab('favorites')}
        >
          <div className={styles.icon}><HeartIcon size={18} /></div>
          <span>Favorites</span>
        </div>

        <div
          className={`${styles.tab} ${tab === 'board' ? styles.on : ''}`}
          onClick={() => onTab('board')}
        >
          <div className={styles.icon}><BoardIcon size={20} /></div>
          <span>The Board</span>
        </div>
      </div>

      <button
        className={styles.addBtn}
        onClick={onAdd}
        aria-label="Add"
      >
        +
      </button>
    </>
  );
}
