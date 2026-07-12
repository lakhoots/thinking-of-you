import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MONTH_NAMES,
  clampMonth,
  computeSkyMonth,
  lifetimeLine,
  monthKey,
  monthSpan,
  relativeDay,
  shiftMonth,
} from '../lib/sky';
import { colorForUser } from '../lib/partnerColors';
import styles from './SparksSky.module.css';

// The sky is a fixed 360×520 viewBox scaled to the panel width, so dot
// geometry is resolution-independent and circles never distort.
const VIEW_W = 360;
const VIEW_H = 520;
const PAD_X = 24;
const PAD_Y = 28;

const dotX = (x01) => PAD_X + x01 * (VIEW_W - PAD_X * 2);
const dotY = (y01) => PAD_Y + y01 * (VIEW_H - PAD_Y * 2);

export default function SparksSky({ sparks, profiles, onClose }) {
  const span = useMemo(() => monthSpan(sparks), [sparks]);
  // cursor: the month on show; dir: which way the last change went, so the
  // page slides in from the side you swiped toward.
  const [{ cursor, dir }, setNav] = useState(() => ({ cursor: span.max, dir: 0 }));
  const [bloom, setBloom] = useState(null);
  const swipeRef = useRef(null);

  const month = clampMonth(cursor, span);
  const key = monthKey(month.year, month.monthIndex);
  const { dots, constellations } = useMemo(
    () => computeSkyMonth(sparks, month.year, month.monthIndex),
    [sparks, month.year, month.monthIndex],
  );

  const hasPrev = key > monthKey(span.min.year, span.min.monthIndex);
  const hasNext = key < monthKey(span.max.year, span.max.monthIndex);

  const go = (delta) => {
    if (delta < 0 && !hasPrev) return;
    if (delta > 0 && !hasNext) return;
    setBloom(null);
    setNav({ cursor: clampMonth(shiftMonth(month, delta), span), dir: delta });
  };

  // Horizontal swipe between month pages. Vertical scrolling stays native
  // (touch-action: pan-y on the panel).
  const onPointerDown = (e) => {
    swipeRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(dx < 0 ? 1 : -1);
    }
  };

  const line = lifetimeLine(sparks);
  const bloomSpark = bloom?.spark;
  // Bubble sits above its dot unless the dot is near the top of the sky.
  const bloomBelow = bloom ? bloom.y01 < 0.22 : false;
  const bloomLeftPct = bloom
    ? Math.min(80, Math.max(20, (dotX(bloom.x01) / VIEW_W) * 100))
    : 0;
  const bloomTopPct = bloom ? (dotY(bloom.y01) / VIEW_H) * 100 : 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onClose} aria-label="Back to sparks">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className={styles.monthTitle}>
          {MONTH_NAMES[month.monthIndex]} {month.year}
        </div>
        <div className={styles.monthNav}>
          <button
            className={styles.navBtn}
            onClick={() => go(-1)}
            disabled={!hasPrev}
            aria-label="Previous month"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            className={styles.navBtn}
            onClick={() => go(1)}
            disabled={!hasNext}
            aria-label="Next month"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      {line && <div className={styles.lifetime}>{line}</div>}

      <div className={styles.skyWrap}>
        <div
          className={styles.panel}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={key}
              className={styles.monthPage}
              initial={{ opacity: 0, x: dir * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -28 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <svg
                className={styles.svg}
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                onClick={() => setBloom(null)}
              >
                {constellations.map((c) => (
                  <polyline
                    key={c.day}
                    className={styles.constellation}
                    points={c.dots.map((d) => `${dotX(d.x01)},${dotY(d.y01)}`).join(' ')}
                  />
                ))}
                {dots.map((d) => {
                  const color = colorForUser(d.authorId, profiles);
                  const cx = dotX(d.x01);
                  const cy = dotY(d.y01);
                  return (
                    <g
                      key={d.id}
                      className={styles.dot}
                      onClick={(e) => {
                        e.stopPropagation();
                        setBloom((b) => (b?.id === d.id ? null : d));
                      }}
                    >
                      {/* invisible hit area — ≥32px on a phone-width sky */}
                      <circle cx={cx} cy={cy} r="15" fill="transparent" />
                      <circle cx={cx} cy={cy} r="7" fill={color} opacity="0.22" />
                      <circle cx={cx} cy={cy} r="3.2" fill={color} />
                      <circle cx={cx} cy={cy} r="1.1" fill="#F0E6D0" opacity="0.85" />
                    </g>
                  );
                })}
              </svg>

              {dots.length === 0 && (
                <div className={styles.emptyMonth}>
                  A quiet month — just open sky.
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {bloomSpark && (
              <motion.div
                key={bloom.id}
                className={styles.bloomAnchor}
                style={{
                  left: `${bloomLeftPct}%`,
                  top: `${bloomTopPct}%`,
                  transform: bloomBelow
                    ? 'translate(-50%, 14px)'
                    : 'translate(-50%, calc(-100% - 14px))',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
              <motion.div
                className={styles.bloom}
                style={{ transformOrigin: bloomBelow ? 'top center' : 'bottom center' }}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                onClick={(e) => e.stopPropagation()}
              >
                {bloomSpark.emoji && (
                  <div className={styles.bloomEmoji}>{bloomSpark.emoji}</div>
                )}
                {bloomSpark.note && (
                  <div className={styles.bloomNote}>
                    {bloomSpark.note.length > 90
                      ? `${bloomSpark.note.slice(0, 90).trimEnd()}…`
                      : bloomSpark.note}
                  </div>
                )}
                <div className={styles.bloomMeta}>
                  <span
                    className={styles.bloomPip}
                    style={{ background: colorForUser(bloomSpark.author_id, profiles) }}
                  />
                  {relativeDay(bloomSpark.created_at)}
                </div>
              </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
