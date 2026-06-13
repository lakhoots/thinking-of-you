import { getListTheme } from '../lib/listThemes';
import styles from './ListSticker.module.css';

// Small line icon for a theme, used by the create form and the list sheet
// header (no emoji). Inherits color from `currentColor`.
export function ListGlyph({ shape, size = 22 }) {
  if (shape === 'ticket') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v1.2a1.6 1.6 0 0 0 0 4.6v1.2A1.5 1.5 0 0 1 18.5 17h-13A1.5 1.5 0 0 1 4 15.5v-1.2a1.6 1.6 0 0 0 0-4.6z" />
        <path d="M13.5 7.5v9" strokeDasharray="1.5 2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h9l3 3v13H6z" />
      <path d="M9 11l1.6 1.6L14 9" />
      <path d="M9 16h6" />
    </svg>
  );
}

// The board face of a themed list: an uploaded image, a movie-ticket stub, or
// a checklist card that previews the actual items.
export default function ListSticker({ memento }) {
  const theme = getListTheme(memento.list_theme);
  const items = memento.list_items ?? [];
  const total = items.length;
  const checked = items.filter((i) => i.checked).length;
  const title = memento.title || theme.label;
  const meta =
    total === 0
      ? 'Tap to add'
      : checked > 0
        ? `${checked} / ${total} ${theme.checkedVerb}`
        : `${total} ${theme.countNoun}`;

  // Custom uploaded image — frameless, like a transparent-PNG photo.
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

  // Movie list — an admission-ticket stub.
  if (theme.shape === 'ticket') {
    return (
      <div className={styles.ticket} style={{ '--accent': theme.accent }}>
        <div className={styles.tHead}>
          <span>ADMIT TWO</span>
          <span className={styles.tNo}>Nº{String(total).padStart(2, '0')}</span>
        </div>
        <div className={styles.tBody}>
          <div className={styles.tKicker}>NOW SHOWING</div>
          <div className={styles.tTitle}>{title}</div>
          <div className={styles.tStars} aria-hidden>★★★★★</div>
        </div>
        <div className={styles.tPerf} aria-hidden />
        <div className={styles.tStub}>
          <div className={styles.tBarcode} aria-hidden />
          <div className={styles.tMeta}>{meta}</div>
        </div>
      </div>
    );
  }

  // Custom list — a checklist card previewing the first few items.
  const preview = items.slice(0, 4);
  return (
    <div className={styles.card} style={{ '--accent': theme.accent }}>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.cardList}>
        {preview.length === 0 ? (
          <span className={styles.cardEmpty}>Tap to add items…</span>
        ) : (
          preview.map((it) => (
            <span key={it.id} className={`${styles.cardItem} ${it.checked ? styles.cardItemDone : ''}`}>
              <span className={styles.cardBox}>{it.checked ? '✓' : ''}</span>
              <span className={styles.cardItemText}>{it.text}</span>
            </span>
          ))
        )}
        {total > preview.length && (
          <span className={styles.cardMore}>+{total - preview.length} more</span>
        )}
      </div>
      <div className={styles.cardMeta}>{meta}</div>
    </div>
  );
}
