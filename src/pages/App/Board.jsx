import { useCallback, useEffect, useRef, useState } from 'react';
import MementoCard, { CARD_W, CARD_H } from '../../components/MementoCard';
import styles from './Board.module.css';

const CANVAS_W = 3200;
const CANVAS_H = 2600;
const MIN_SCALE = 0.18;
const MAX_SCALE = 2.0;
const INITIAL_SCALE = 0.38;

export default function Board({ mementos, partners, partnershipLabel, lastAddedId }) {
  const [flippedId, setFlippedId] = useState(null);
  const [enteringId, setEnteringId] = useState(null);

  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const tx = useRef({ x: 0, y: 0, s: INITIAL_SCALE });
  const ptrs = useRef(new Map());
  const pinchDist = useRef(null);
  const moved = useRef(false);
  const ptrStart = useRef({ x: 0, y: 0 });

  const applyTx = useCallback(() => {
    if (!canvasRef.current) return;
    const { x, y, s } = tx.current;
    canvasRef.current.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  }, []);

  const centerCanvas = useCallback(() => {
    const vp = viewportRef.current?.getBoundingClientRect();
    if (!vp) return;
    tx.current = {
      x: vp.width / 2 - (CANVAS_W / 2) * INITIAL_SCALE,
      y: vp.height / 2 - (CANVAS_H / 2) * INITIAL_SCALE,
      s: INITIAL_SCALE,
    };
    applyTx();
  }, [applyTx]);

  // Initial centering — wait for layout to settle, then again on resize.
  useEffect(() => {
    const id = requestAnimationFrame(() => centerCanvas());
    const onResize = () => centerCanvas();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', onResize);
    };
  }, [centerCanvas]);

  // Pan to a freshly added card so the author sees it land.
  useEffect(() => {
    if (!lastAddedId) return;
    const m = mementos.find((x) => x.id === lastAddedId);
    if (!m) return;
    setEnteringId(lastAddedId);
    const t = setTimeout(() => setEnteringId(null), 700);

    const vp = viewportRef.current?.getBoundingClientRect();
    if (vp) {
      const s = Math.max(tx.current.s, 0.52);
      const px = m.pos_x * CANVAS_W;
      const py = m.pos_y * CANVAS_H;
      tx.current = {
        x: vp.width / 2 - px * s,
        y: vp.height / 2 - py * s,
        s,
      };
      applyTx();
    }
    return () => clearTimeout(t);
  }, [lastAddedId, mementos, applyTx]);

  const onPtrDown = useCallback((e) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    ptrStart.current = { x: e.clientX, y: e.clientY };
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }, []);

  const onPtrMove = useCallback((e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    const prev = ptrs.current.get(e.pointerId);
    const curr = { x: e.clientX, y: e.clientY };
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    if (Math.hypot(curr.x - ptrStart.current.x, curr.y - ptrStart.current.y) > 6) {
      moved.current = true;
    }

    if (ptrs.current.size === 1) {
      tx.current.x += dx;
      tx.current.y += dy;
      applyTx();
    } else if (ptrs.current.size === 2) {
      const other = [...ptrs.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (other && pinchDist.current) {
        const dist = Math.hypot(curr.x - other.x, curr.y - other.y);
        const factor = dist / pinchDist.current;
        const mid = { x: (curr.x + other.x) / 2, y: (curr.y + other.y) / 2 };
        const oldS = tx.current.s;
        const newS = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldS * factor));
        tx.current.x = mid.x - (mid.x - tx.current.x) * (newS / oldS);
        tx.current.y = mid.y - (mid.y - tx.current.y) * (newS / oldS);
        tx.current.s = newS;
        applyTx();
        pinchDist.current = dist;
      }
    }
    ptrs.current.set(e.pointerId, curr);
  }, [applyTx]);

  const onPtrUp = useCallback((e) => {
    const wasMoved = moved.current;
    ptrs.current.delete(e.pointerId);
    pinchDist.current = null;
    if (ptrs.current.size === 0) moved.current = false;
    if (!wasMoved) {
      const el = e.target.closest('[data-card-id]');
      if (el) {
        const id = el.dataset.cardId;
        setFlippedId((f) => (f === id ? null : id));
      } else {
        setFlippedId(null);
      }
    }
  }, []);

  // Mouse wheel zoom — passive: false because we preventDefault.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.91 : 1.1;
      const oldS = tx.current.s;
      const newS = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldS * factor));
      tx.current.x = e.clientX - (e.clientX - tx.current.x) * (newS / oldS);
      tx.current.y = e.clientY - (e.clientY - tx.current.y) * (newS / oldS);
      tx.current.s = newS;
      applyTx();
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [applyTx]);

  const authorMap = Object.fromEntries(partners.map((p) => [p.id, p]));

  return (
    <>
      <div className={styles.header}>
        <div className={styles.title}>{partnershipLabel}</div>
        <div className={styles.count}>
          {mementos.length} {mementos.length === 1 ? 'memory' : 'memories'}
        </div>
      </div>

      <div
        ref={viewportRef}
        className={styles.viewport}
        onPointerDown={onPtrDown}
        onPointerMove={onPtrMove}
        onPointerUp={onPtrUp}
        onPointerCancel={onPtrUp}
      >
        <div
          ref={canvasRef}
          className={styles.canvas}
          style={{ width: CANVAS_W, height: CANVAS_H }}
        >
          {mementos.length === 0 && (
            <div className={styles.empty} style={{ left: CANVAS_W / 2, top: CANVAS_H / 2 }}>
              <div className={styles.emptyTitle}>Your board is ready.</div>
              <div className={styles.emptySub}>Tap + to pin your first memory</div>
            </div>
          )}
          {mementos.map((m) => (
            <MementoCard
              key={m.id}
              memento={m}
              author={authorMap[m.author_id]}
              flipped={flippedId === m.id}
              entering={enteringId === m.id}
              x={m.pos_x * CANVAS_W}
              y={m.pos_y * CANVAS_H}
            />
          ))}
        </div>
      </div>
    </>
  );
}
