import { AnimatePresence, motion } from 'framer-motion';
import { colorForUser } from '../lib/partnerColors';
import styles from './MementoStickers.module.css';

// How many stickers a card shows on the board before collapsing into a
// "+N" chip. The detail sheet always lists all of them.
const MAX_VISIBLE = 5;

// The sticker layer sits inside MementoCard's positioned wrapper, so it
// inherits the card's transform (drag, pan, zoom, rotation) for free.
// Anchors are 0–1 fractions of the card face. Stickers are front-face
// marginalia — they fade away while the card is flipped.
export default function MementoStickers({ stickers, partners, hidden, fanned, chipEnabled }) {
  if (!stickers?.length) return null;

  const overflow = stickers.length - MAX_VISIBLE;
  const visible = fanned || overflow <= 0 ? stickers : stickers.slice(0, MAX_VISIBLE);

  return (
    <div className={`${styles.layer} ${hidden ? styles.hiddenLayer : ''}`}>
      <AnimatePresence>
        {visible.map((s, i) => {
          const color = colorForUser(s.author_id, partners);
          // The bubble grows away from the card's centre — top-half anchors
          // bloom upward, bottom-half downward — keeping the middle clear.
          const below = s.anchor_y >= 0.5;
          return (
            <motion.div
              key={s.id}
              className={styles.anchor}
              style={{ left: `${s.anchor_x * 100}%`, top: `${s.anchor_y * 100}%` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className={`${styles.place} ${below ? styles.placeBelow : ''}`}>
                <motion.div
                  className={styles.pop}
                  style={{ transformOrigin: below ? 'top center' : 'bottom center' }}
                  initial={{ scale: 0.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0, rotate: -14, y: 8 }}
                  transition={{
                    type: 'spring',
                    stiffness: 480,
                    damping: 17,
                    delay: fanned && i >= MAX_VISIBLE ? (i - MAX_VISIBLE) * 0.05 : 0,
                  }}
                >
                  <div
                    className={`${styles.bubble} ${below ? styles.bubbleBelow : ''}`}
                    style={{ borderColor: color, transform: `rotate(${s.rotation}deg)` }}
                  >
                    <span className={styles.emoji}>{s.emoji}</span>
                    {s.caption && (
                      <span className={styles.caption} style={{ color }}>
                        {s.caption}
                      </span>
                    )}
                    <span
                      className={`${styles.tail} ${below ? styles.tailBelow : ''}`}
                      style={{ borderColor: color }}
                    />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {overflow > 0 && (
        <button
          type="button"
          className={`${styles.moreChip} ${!chipEnabled ? styles.chipDisabled : ''}`}
          data-sticker-fan
          aria-label={fanned ? 'Collapse stickers' : `Show ${overflow} more stickers`}
        >
          {fanned ? '×' : `+${overflow}`}
        </button>
      )}
    </div>
  );
}
