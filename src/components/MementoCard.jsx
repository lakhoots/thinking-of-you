import { fmtDate } from '../lib/format';
import styles from './MementoCard.module.css';

const CARD_W = 138;
const CARD_H = 170;

export default function MementoCard({ memento, author, flipped, entering, x, y }) {
  const { type, image_url, title, note, emoji, date, rotation } = memento;
  const authorName = author?.name || '';
  const authorColor = author?.accent_color || '#9C5E4A';

  return (
    <div
      className={styles.wrap}
      data-card-id={memento.id}
      style={{
        left: x - CARD_W / 2,
        top: y - CARD_H / 2,
        width: CARD_W,
        height: CARD_H,
        transform: `rotate(${rotation}deg)`,
        zIndex: flipped ? 50 : 1,
      }}
    >
      <div className={styles.perspective}>
        <div className={`${styles.inner} ${flipped ? styles.flipped : ''}`}>
          <div className={`${styles.face} ${styles.front} ${entering ? styles.entering : ''}`}>
            {type === 'photo' && (
              <>
                <div className={styles.img}>
                  {image_url ? <img src={image_url} alt="" /> : <span className={styles.placeholder}>📷</span>}
                </div>
                <div className={styles.footer}>
                  <span>{title || fmtDate(date)}</span>
                </div>
              </>
            )}
            {type === 'note' && (
              <>
                <div className={styles.noteBody}><p>{note || '…'}</p></div>
                <div className={styles.footer}>
                  <span>{title || fmtDate(date)}</span>
                </div>
              </>
            )}
            {type === 'emoji' && (
              <>
                <div className={styles.emojiBody}>{emoji}</div>
                <div className={styles.footer}>
                  <span>{title || fmtDate(date)}</span>
                </div>
              </>
            )}
          </div>

          <div className={`${styles.face} ${styles.back}`}>
            <div className={`${styles.backNote} ${!note ? styles.empty : ''}`}>
              {note || '(no note)'}
            </div>
            <div className={styles.backFooter}>
              <div className={styles.backDate}>{fmtDate(date)}</div>
              <div className={styles.backAuthor}>
                <div className={styles.authorPip} style={{ background: authorColor }} />
                <div className={styles.authorName}>{authorName}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { CARD_W, CARD_H };
