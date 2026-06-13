import { getListTheme } from '../lib/listThemes';
import styles from './ListSticker.module.css';

// The board face of a themed list. Either a custom uploaded image (rendered
// frameless, like a transparent-PNG photo) or a parametric themed shape
// (ticket / recipe card / label) drawn from the theme spec.
export default function ListSticker({ memento }) {
  const theme = getListTheme(memento.list_theme);
  const items = memento.list_items ?? [];
  const total = items.length;
  const checked = items.filter((i) => i.checked).length;
  const title = memento.title || theme.label;

  // Progress line: once anything is checked, show "done / total"; otherwise
  // show how many are queued up.
  const meta =
    total === 0
      ? 'Tap to add'
      : checked > 0
        ? `${checked} / ${total} ${theme.checkedVerb}`
        : `${total} ${theme.countNoun}`;

  if (memento.image_url) {
    return (
      <div className={styles.customWrap}>
        <img className={styles.customImg} src={memento.image_url} alt="" draggable={false} />
        <div className={styles.customCaption}>
          <span className={styles.customTitle}>{title}</span>
          <span className={styles.customMeta}>{meta}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.sticker} ${styles[theme.shape] || ''}`}
      style={{ '--accent': theme.accent }}
    >
      <div className={styles.emoji}>{theme.emoji}</div>
      <div className={styles.name}>{title}</div>
      <div className={styles.meta}>{meta}</div>
    </div>
  );
}
