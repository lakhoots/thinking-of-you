import { useCallback, useEffect, useRef, useState } from 'react';
import MementoCard, { CARD_W, CARD_H } from '../../components/MementoCard';
import MementoDetailSheet from '../../components/MementoDetailSheet';
import ListSheet from '../../components/ListSheet';
import StickerComposer from '../../components/StickerComposer';
import { deleteMemento, moveMementos } from '../../lib/mementos';
import { pickStickerAnchor } from '../../lib/stickers';
import { FEATURE_STICKERS } from '../../lib/flags';
import styles from './Board.module.css';

// Long-press dwell before the sticker composer opens on a card.
const STICKER_PRESS_MS = 450;

const CANVAS_W = 3200;
const CANVAS_H = 2600;
const MIN_SCALE = 0.18;
const MAX_SCALE = 2.0;
const INITIAL_SCALE = 0.38;
const FIT_MAX_SCALE = 0.86;
const FIT_SCREEN_PADDING = 34;
const PIN_BOUNDS_PAD = 26;
const DESKTOP_WHEEL_ZOOM_SENSITIVITY = 0.00065;

function boundsForMementos(mementos) {
  if (!mementos.length) return null;

  return mementos.reduce((bounds, m) => {
    const x = m.pos_x * CANVAS_W;
    const y = m.pos_y * CANVAS_H;
    const scaleX = m.scale ?? 1;
    const scaleY = m.scale_y ?? 1;
    const width = CARD_W * scaleX;
    const height = CARD_H * (m.type === 'note' ? scaleY : scaleX);
    const rotation = ((m.rotation ?? 0) * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rotation));
    const sin = Math.abs(Math.sin(rotation));
    const halfW = (width * cos + height * sin) / 2 + PIN_BOUNDS_PAD;
    const halfH = (width * sin + height * cos) / 2 + PIN_BOUNDS_PAD;
    const next = {
      minX: x - halfW,
      minY: y - halfH,
      maxX: x + halfW,
      maxY: y + halfH,
    };

    if (!bounds) return next;
    return {
      minX: Math.min(bounds.minX, next.minX),
      minY: Math.min(bounds.minY, next.minY),
      maxX: Math.max(bounds.maxX, next.maxX),
      maxY: Math.max(bounds.maxY, next.maxY),
    };
  }, null);
}

export default function Board({
  mementos,
  partners,
  partnershipLabel,
  lastAddedId,
  currentUserProfile,
  onOpenSettings,
  onMementoSaved,
  onMementoRemoved,
  onMementoRestored,
  onArrangeModeChange,
  onVisibleRectChange,
}) {
  const [flippedId, setFlippedId] = useState(null);
  const [enteringId, setEnteringId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  // Pending delete: { memento, timer }. While this is set, the pin is
  // hidden locally but not yet deleted from Supabase.
  const [pendingDelete, setPendingDelete] = useState(null);

  // Arrange (drag-to-rearrange) mode. localEdits keys are memento ids
  // whose positions have been changed in this edit session. On Done the
  // batch is sent to move_mementos; on Cancel the map is just cleared.
  const [arrangeMode, setArrangeMode] = useState(false);
  // localEdits[id] = { pos_x?, pos_y?, rotation? }. Each field is only
  // present once the user has touched it in the current edit session.
  const [localEdits, setLocalEdits] = useState({});
  // Ordered list of ids the user has touched this session — last touched
  // last. Drives the order we send to move_mementos so the server can
  // bump z values so the most recent card lands on top.
  const [moveOrder, setMoveOrder] = useState([]);
  const [savingArrange, setSavingArrange] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const draggingRef = useRef(null);
  const resizingRef = useRef(null);

  // Stickers: long-press a card to open the composer at the pressed point;
  // fannedId is the card whose overflow stickers are fanned out.
  const [stickerTarget, setStickerTarget] = useState(null);
  const [fannedId, setFannedId] = useState(null);
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => clearLongPress, [clearLongPress]);

  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const mementosRef = useRef(mementos);
  const tx = useRef({ x: 0, y: 0, s: INITIAL_SCALE });
  const ptrs = useRef(new Map());
  const pinchDist = useRef(null);
  const moved = useRef(false);
  const hadMulti = useRef(false);
  const ptrStart = useRef({ x: 0, y: 0 });

  const applyTx = useCallback(() => {
    if (!canvasRef.current) return;
    const { x, y, s } = tx.current;
    canvasRef.current.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    const vp = viewportRef.current?.getBoundingClientRect();
    if (vp) {
      onVisibleRectChange?.({
        minX: Math.max(0, (-x) / s / CANVAS_W),
        maxX: Math.min(1, (vp.width - x) / s / CANVAS_W),
        minY: Math.max(0, (-y) / s / CANVAS_H),
        maxY: Math.min(1, (vp.height - y) / s / CANVAS_H),
      });
    }
  }, [onVisibleRectChange]);

  useEffect(() => {
    mementosRef.current = mementos;
  }, [mementos]);

  const centerCanvas = useCallback(() => {
    const vp = viewportRef.current?.getBoundingClientRect();
    if (!vp) return;
    const bounds = boundsForMementos(mementosRef.current);

    if (bounds) {
      const boundsW = Math.max(1, bounds.maxX - bounds.minX);
      const boundsH = Math.max(1, bounds.maxY - bounds.minY);
      const usableW = Math.max(1, vp.width - FIT_SCREEN_PADDING * 2);
      const usableH = Math.max(1, vp.height - FIT_SCREEN_PADDING * 2);
      const s = Math.max(
        MIN_SCALE,
        Math.min(FIT_MAX_SCALE, MAX_SCALE, usableW / boundsW, usableH / boundsH),
      );
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;

      tx.current = {
        x: vp.width / 2 - centerX * s,
        y: vp.height / 2 - centerY * s,
        s,
      };
      applyTx();
      return;
    }

    tx.current = {
      x: vp.width / 2 - (CANVAS_W / 2) * INITIAL_SCALE,
      y: vp.height / 2 - (CANVAS_H / 2) * INITIAL_SCALE,
      s: INITIAL_SCALE,
    };
    applyTx();
  }, [applyTx]);

  // Initial fit — wait for layout to settle, then again on resize.
  useEffect(() => {
    const id = requestAnimationFrame(() => centerCanvas());
    const onResize = () => centerCanvas();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', onResize);
    };
  }, [centerCanvas, mementos.length]);

  // Pan to a freshly added card so the author sees it land.
  useEffect(() => {
    if (!lastAddedId) return;
    const m = mementos.find((x) => x.id === lastAddedId);
    if (!m) return;
    let t;
    const frame = requestAnimationFrame(() => {
      setEnteringId(lastAddedId);
      t = setTimeout(() => setEnteringId(null), 700);

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
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(t);
    };
  }, [lastAddedId, mementos, applyTx]);

  const onPtrDown = useCallback((e) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) {
      moved.current = false;
      hadMulti.current = false;
      ptrStart.current = { x: e.clientX, y: e.clientY };

      // In arrange mode, a single finger that lands on a card grabs it
      // for dragging. Otherwise (empty space) it falls through to a pan.
      if (arrangeMode) {
        // Resize handle wins over card body (it's a child of the card).
        const handleEl = e.target.closest('[data-resize-handle]');
        if (handleEl) {
          const id = handleEl.dataset.resizeHandle;
          const m = mementos.find((x) => x.id === id);
          if (m) {
            setMoveOrder((prev) => [...prev.filter((x) => x !== id), id]);
            const edit = localEdits[id] ?? {};
            const posX = edit.pos_x ?? m.pos_x;
            const posY = edit.pos_y ?? m.pos_y;
            const scaleX = edit.scale ?? m.scale ?? 1;
            const scaleY = edit.scale_y ?? m.scale_y ?? 1;
            const rotDeg = edit.rotation ?? m.rotation ?? 0;
            const centerScreenX = tx.current.x + posX * CANVAS_W * tx.current.s;
            const centerScreenY = tx.current.y + posY * CANVAS_H * tx.current.s;
            const dx0 = e.clientX - centerScreenX;
            const dy0 = e.clientY - centerScreenY;
            // Rotate the pointer offset into the card's local frame so x/y
            // axes line up with card width/height regardless of rotation.
            const rad = (rotDeg * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const dx0Local = dx0 * cos + dy0 * sin;
            const dy0Local = -dx0 * sin + dy0 * cos;
            const startDist = Math.max(8, Math.hypot(dx0, dy0));
            resizingRef.current = {
              id,
              uniform: m.type !== 'note', // notes resize per-axis; others uniform
              rotRad: rad,
              centerScreenX,
              centerScreenY,
              startDist,
              startDxLocal: Math.max(8, Math.abs(dx0Local)) * Math.sign(dx0Local || 1),
              startDyLocal: Math.max(8, Math.abs(dy0Local)) * Math.sign(dy0Local || 1),
              startScaleX: scaleX,
              startScaleY: scaleY,
            };
          }
        } else {
          const cardEl = e.target.closest('[data-card-id]');
          if (cardEl) {
            const id = cardEl.dataset.cardId;
            const m = mementos.find((x) => x.id === id);
            if (m) {
              const edit = localEdits[id] ?? {};
              draggingRef.current = {
                id,
                startScreenX: e.clientX,
                startScreenY: e.clientY,
                startPosX: edit.pos_x ?? m.pos_x,
                startPosY: edit.pos_y ?? m.pos_y,
              };
              setDraggingId(id);
              setMoveOrder((prev) => [...prev.filter((x) => x !== id), id]);
            }
          }
        }
      } else if (FEATURE_STICKERS) {
        // Long-press on a card (normal mode) opens the sticker composer at
        // the pressed point. Fires only if the finger stays put and single.
        const cardEl = e.target.closest('[data-card-id]');
        if (cardEl) {
          const cardId = cardEl.dataset.cardId;
          const { clientX, clientY } = e;
          longPressTimer.current = setTimeout(() => {
            longPressTimer.current = null;
            if (moved.current || hadMulti.current || ptrs.current.size !== 1) return;
            const m = mementosRef.current.find((x) => x.id === cardId);
            if (!m) return;
            longPressFired.current = true;
            // Screen → canvas → card-local, undoing the canvas transform,
            // then the card's rotation and scale, to get 0–1 face anchors.
            const { x, y, s } = tx.current;
            const dx = (clientX - x) / s - m.pos_x * CANVAS_W;
            const dy = (clientY - y) / s - m.pos_y * CANVAS_H;
            const rad = ((m.rotation ?? 0) * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const dxLocal = dx * cos + dy * sin;
            const dyLocal = -dx * sin + dy * cos;
            const scaleX = m.scale ?? 1;
            const scaleY = m.type === 'note' ? (m.scale_y ?? 1) : scaleX;
            // Snap the pressed point to the least obstructive spot along
            // the card's edges, dodging stickers already there.
            const anchor = pickStickerAnchor(
              0.5 + dxLocal / (CARD_W * scaleX),
              0.5 + dyLocal / (CARD_H * scaleY),
              m.stickers ?? [],
            );
            setFlippedId(null);
            setFannedId(null);
            setStickerTarget({
              mementoId: cardId,
              anchorX: anchor.x,
              anchorY: anchor.y,
            });
          }, STICKER_PRESS_MS);
        }
      }
    } else {
      // Any second finger landing means this gesture is no longer a tap,
      // and any in-flight card interaction is abandoned in favor of pinch/zoom.
      hadMulti.current = true;
      clearLongPress();
      if (draggingRef.current) {
        draggingRef.current = null;
        setDraggingId(null);
      }
      resizingRef.current = null;
    }
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }, [arrangeMode, mementos, localEdits, clearLongPress]);

  const onPtrMove = useCallback((e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    const prev = ptrs.current.get(e.pointerId);
    const curr = { x: e.clientX, y: e.clientY };
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    if (Math.hypot(curr.x - ptrStart.current.x, curr.y - ptrStart.current.y) > 6) {
      moved.current = true;
      clearLongPress();
    }

    // Resize: pointer's distance from card center vs. starting distance
    // gives the scale ratio. Center stays put; only scale(s) change.
    if (resizingRef.current && ptrs.current.size === 1) {
      const r = resizingRef.current;
      const dxc = curr.x - r.centerScreenX;
      const dyc = curr.y - r.centerScreenY;
      if (r.uniform) {
        const dist = Math.hypot(dxc, dyc);
        const ratio = dist / r.startDist;
        const newScale = Math.max(0.4, Math.min(2.5, r.startScaleX * ratio));
        setLocalEdits((prev) => ({
          ...prev,
          [r.id]: { ...(prev[r.id] ?? {}), scale: newScale, scale_y: newScale },
        }));
      } else {
        // Note: independent X / Y scale in the card's local (post-rotation)
        // frame, so dragging right widens, dragging down lengthens.
        const cos = Math.cos(r.rotRad);
        const sin = Math.sin(r.rotRad);
        const dxLocal = dxc * cos + dyc * sin;
        const dyLocal = -dxc * sin + dyc * cos;
        const ratioX = dxLocal / r.startDxLocal;
        const ratioY = dyLocal / r.startDyLocal;
        const newScaleX = Math.max(0.5, Math.min(3, r.startScaleX * ratioX));
        const newScaleY = Math.max(0.5, Math.min(3, r.startScaleY * ratioY));
        setLocalEdits((prev) => ({
          ...prev,
          [r.id]: { ...(prev[r.id] ?? {}), scale: newScaleX, scale_y: newScaleY },
        }));
      }
      ptrs.current.set(e.pointerId, curr);
      return;
    }

    // Drag the grabbed card in arrange mode. Convert screen delta into
    // normalized canvas coords by undoing the current zoom and canvas size.
    if (draggingRef.current && ptrs.current.size === 1) {
      const d = draggingRef.current;
      const dxScreen = curr.x - d.startScreenX;
      const dyScreen = curr.y - d.startScreenY;
      const scale = tx.current.s;
      const nx = d.startPosX + (dxScreen / scale) / CANVAS_W;
      const ny = d.startPosY + (dyScreen / scale) / CANVAS_H;
      // Clamp to the visible canvas so cards can't be dragged off-board.
      const clampedX = Math.max(0.02, Math.min(0.98, nx));
      const clampedY = Math.max(0.02, Math.min(0.98, ny));
      setLocalEdits((prevMap) => ({
        ...prevMap,
        [d.id]: { ...(prevMap[d.id] ?? {}), pos_x: clampedX, pos_y: clampedY },
      }));
      ptrs.current.set(e.pointerId, curr);
      return;
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
  }, [applyTx, clearLongPress]);

  const onPtrUp = useCallback((e) => {
    const wasLast = ptrs.current.size === 1;
    const wasMoved = moved.current;
    const wasMulti = hadMulti.current;
    const draggedId = draggingRef.current?.id ?? null;
    const resizingId = resizingRef.current?.id ?? null;
    clearLongPress();
    // A fired long-press already opened the composer — the release that
    // follows must not read as a tap (which would flip the card under it).
    const suppressTap = longPressFired.current;
    if (wasLast) longPressFired.current = false;
    ptrs.current.delete(e.pointerId);
    pinchDist.current = null;
    if (ptrs.current.size === 0) {
      moved.current = false;
      hadMulti.current = false;
      if (draggingRef.current) {
        draggingRef.current = null;
        setDraggingId(null);
      }
      resizingRef.current = null;
    }

    if (arrangeMode) {
      // Resize gesture released — keep the card selected and don't treat
      // as a tap.
      if (resizingId) return;
      // In arrange mode, a non-moved single-finger gesture is a tap:
      // on a card → select it; on empty space → deselect.
      if (wasLast && !wasMulti && !wasMoved) {
        if (draggedId) setSelectedId(draggedId);
        else setSelectedId(null);
      }
      return;
    }

    // Tap: only when this was the final pointer up, the gesture never had a
    // second finger, and no movement happened. List stickers flip straight
    // open into their dedicated view; everything else flips in place.
    if (wasLast && !wasMulti && !wasMoved && !suppressTap) {
      // The +N chip fans a card's overflow stickers in and out.
      const fanEl = e.target.closest('[data-sticker-fan]');
      if (fanEl) {
        const cardEl = fanEl.closest('[data-card-id]');
        const id = cardEl?.dataset.cardId;
        if (id) setFannedId((f) => (f === id ? null : id));
        return;
      }
      const el = e.target.closest('[data-card-id]');
      if (el) {
        const id = el.dataset.cardId;
        if (el.dataset.cardType === 'list') {
          setDetailId(id);
        } else {
          setFlippedId((f) => (f === id ? null : id));
        }
        setFannedId((f) => (f === id ? f : null));
      } else {
        setFlippedId(null);
        setFannedId(null);
      }
    }
  }, [arrangeMode, clearLongPress]);

  // Mouse wheel zoom — passive: false because we preventDefault.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e) => {
      e.preventDefault();
      const deltaY = e.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? e.deltaY * 16
        : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? e.deltaY * vp.clientHeight
          : e.deltaY;
      const factor = Math.exp(-deltaY * DESKTOP_WHEEL_ZOOM_SENSITIVITY);
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

  // Snapshot the memento, remove it from local state, and arm a 5-second
  // timer to commit the delete. Undo cancels the timer and restores the pin.
  const requestDelete = useCallback((id) => {
    const m = mementos.find((x) => x.id === id);
    if (!m) return;
    // If another delete is already pending, commit it immediately so we
    // never have two in flight.
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer);
      deleteMemento(pendingDelete.memento.id).catch((err) =>
        console.error('deferred delete', err),
      );
    }
    onMementoRemoved?.(id);
    const timer = setTimeout(async () => {
      try {
        await deleteMemento(id);
      } catch (err) {
        console.error('delete memento', err);
        onMementoRestored?.(m);
      } finally {
        setPendingDelete((curr) => (curr?.memento.id === id ? null : curr));
      }
    }, 5000);
    setPendingDelete({ memento: m, timer });
  }, [mementos, pendingDelete, onMementoRemoved, onMementoRestored]);

  const undoDelete = useCallback(() => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    onMementoRestored?.(pendingDelete.memento);
    setPendingDelete(null);
  }, [pendingDelete, onMementoRestored]);

  // Commit any pending delete on unmount so the user's intent isn't lost.
  useEffect(() => {
    return () => {
      if (pendingDelete) {
        clearTimeout(pendingDelete.timer);
        deleteMemento(pendingDelete.memento.id).catch((err) =>
          console.error('unmount delete', err),
        );
      }
    };
  }, [pendingDelete]);

  const baseMementos = pendingDelete
    ? mementos.filter((m) => m.id !== pendingDelete.memento.id)
    : mementos;
  // While arranging, preview the stack order the server will produce on
  // Done — anything touched in this session sorts above untouched cards,
  // in the order they were touched (last touched last → on top).
  const baseMaxZ = arrangeMode
    ? Math.max(0, ...baseMementos.map((m) => m.z ?? 0))
    : 0;
  const effectiveZ = (m) => {
    if (!arrangeMode) return m.z ?? 0;
    const idx = moveOrder.indexOf(m.id);
    if (idx === -1) return m.z ?? 0;
    return baseMaxZ + idx + 1;
  };
  const visibleMementos = baseMementos
    .slice()
    .sort((a, b) => {
      const az = effectiveZ(a);
      const bz = effectiveZ(b);
      if (az !== bz) return az - bz;
      // Stable tiebreaker for untouched pins, so they keep their pin-date order.
      return (a.created_at ?? '').localeCompare(b.created_at ?? '');
    });

  useEffect(() => {
    onArrangeModeChange?.(arrangeMode);
  }, [arrangeMode, onArrangeModeChange]);

  const enterArrange = () => {
    setFlippedId(null);
    setSelectedId(null);
    setFannedId(null);
    setStickerTarget(null);
    setLocalEdits({});
    setMoveOrder([]);
    setArrangeMode(true);
  };

  const cancelArrange = () => {
    setLocalEdits({});
    setMoveOrder([]);
    setSelectedId(null);
    setArrangeMode(false);
  };

  const doneArrange = async () => {
    if (savingArrange) return;
    // Build moves in moveOrder (last touched last) so the server's z bump
    // lands the most recently moved card on top. Anything in localEdits
    // not in moveOrder (shouldn't happen, but be safe) comes first.
    const orderedIds = [
      ...moveOrder.filter((id) => id in localEdits),
      ...Object.keys(localEdits).filter((id) => !moveOrder.includes(id)),
    ];
    const moves = orderedIds.map((id) => {
      const edit = localEdits[id];
      const orig = mementos.find((x) => x.id === id);
      return {
        id,
        pos_x: edit.pos_x ?? orig?.pos_x ?? 0.5,
        pos_y: edit.pos_y ?? orig?.pos_y ?? 0.5,
        // rotation + scale + scale_y are optional — RPC coalesces when absent.
        ...(edit.rotation !== undefined ? { rotation: edit.rotation } : {}),
        ...(edit.scale !== undefined ? { scale: edit.scale } : {}),
        ...(edit.scale_y !== undefined ? { scale_y: edit.scale_y } : {}),
      };
    });
    if (moves.length === 0) {
      setSelectedId(null);
      setArrangeMode(false);
      return;
    }
    setSavingArrange(true);
    try {
      await moveMementos(moves);
      // Local optimistic z bump matching the server's logic, so the
      // reordering shows up immediately without waiting for the realtime
      // round-trip. The server will overwrite with the authoritative
      // values when the UPDATE event lands.
      const baseZ = Math.max(0, ...mementos.map((m) => m.z ?? 0));
      moves.forEach((m, i) =>
        onMementoSaved?.({
          id: m.id,
          pos_x: m.pos_x,
          pos_y: m.pos_y,
          z: baseZ + i + 1,
          ...(m.rotation !== undefined ? { rotation: m.rotation } : {}),
          ...(m.scale !== undefined ? { scale: m.scale } : {}),
          ...(m.scale_y !== undefined ? { scale_y: m.scale_y } : {}),
        }),
      );
      setLocalEdits({});
      setMoveOrder([]);
      setSelectedId(null);
      setArrangeMode(false);
    } catch (err) {
      console.error('move_mementos', err);
    } finally {
      setSavingArrange(false);
    }
  };

  const setRotation = (id, deg) => {
    setLocalEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), rotation: deg },
    }));
  };

  const selectedMemento = selectedId ? mementos.find((m) => m.id === selectedId) : null;
  const selectedRotation = selectedMemento
    ? (localEdits[selectedId]?.rotation ?? selectedMemento.rotation)
    : 0;

  return (
    <>
      <div className={`${styles.header} ${arrangeMode ? styles.headerArrange : ''}`}>
        {arrangeMode ? (
          <>
            <button
              className={styles.headerCancel}
              onClick={cancelArrange}
              disabled={savingArrange}
            >
              Cancel
            </button>
            <div className={styles.headerArrangeTitle}>Drag pins to rearrange</div>
            <button
              className={styles.headerDone}
              onClick={doneArrange}
              disabled={savingArrange}
            >
              {savingArrange ? 'Saving…' : 'Done'}
            </button>
          </>
        ) : (
          <>
            <div className={styles.title}>{partnershipLabel}</div>
            <div className={styles.headerRight}>
              <div className={styles.count}>
                {mementos.length} {mementos.length === 1 ? 'memory' : 'memories'}
              </div>
              <button
                className={styles.arrangeBtn}
                onClick={enterArrange}
                disabled={mementos.length === 0}
                aria-label="Arrange pins"
                title="Arrange pins"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 9l-2 3 2 3M19 9l2 3-2 3M9 5l3-2 3 2M9 19l3 2 3-2" />
                </svg>
              </button>
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
          </>
        )}
      </div>

      <div
        ref={viewportRef}
        className={`${styles.viewport} ${arrangeMode ? styles.viewportArrange : ''}`}
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
          {visibleMementos.length === 0 && !pendingDelete && (
            <div className={styles.empty} style={{ left: CANVAS_W / 2, top: CANVAS_H / 2 }}>
              <div className={styles.emptyTitle}>Your board is ready.</div>
              <div className={styles.emptySub}>Tap + to pin your first memory</div>
            </div>
          )}
          {visibleMementos.map((m) => {
            const lp = localEdits[m.id];
            const px = (lp?.pos_x ?? m.pos_x) * CANVAS_W;
            const py = (lp?.pos_y ?? m.pos_y) * CANVAS_H;
            const rot = lp?.rotation ?? m.rotation;
            const sclX = lp?.scale ?? m.scale ?? 1;
            const sclY = lp?.scale_y ?? m.scale_y ?? 1;
            return (
              <MementoCard
                key={m.id}
                memento={m}
                author={authorMap[m.author_id]}
                partners={partners}
                flipped={flippedId === m.id}
                entering={enteringId === m.id}
                x={px}
                y={py}
                rotationOverride={rot}
                scaleOverride={sclX}
                scaleYOverride={sclY}
                onOpenDetail={setDetailId}
                arrangeMode={arrangeMode}
                dragging={draggingId === m.id}
                selected={selectedId === m.id}
                stickersFanned={fannedId === m.id}
              />
            );
          })}
        </div>
      </div>

      {detailId && (() => {
        const dm = mementos.find((m) => m.id === detailId);
        const dAuthor = authorMap[dm?.author_id];
        if (dm?.type === 'list') {
          return (
            <ListSheet
              memento={dm}
              author={dAuthor}
              currentUserId={currentUserProfile?.id}
              onClose={() => setDetailId(null)}
              onItemsChanged={(items) => onMementoSaved?.({ id: dm.id, list_items: items })}
              onDeleteRequested={(id) => {
                setDetailId(null);
                requestDelete(id);
              }}
            />
          );
        }
        return (
          <MementoDetailSheet
            memento={dm}
            author={dAuthor}
            partners={partners}
            currentUserId={currentUserProfile?.id}
            partnershipId={currentUserProfile?.partnership_id}
            onStickersChanged={(stickers) => onMementoSaved?.({ id: dm.id, stickers })}
            onClose={() => setDetailId(null)}
            onSaved={(updated) => {
              onMementoSaved?.(updated);
              setDetailId(null);
            }}
            onDeleteRequested={(id) => {
              setDetailId(null);
              requestDelete(id);
            }}
          />
        );
      })()}

      {stickerTarget && (() => {
        const sm = mementos.find((m) => m.id === stickerTarget.mementoId);
        if (!sm) return null;
        return (
          <StickerComposer
            memento={sm}
            mementos={mementos}
            partnershipId={currentUserProfile?.partnership_id}
            authorId={currentUserProfile?.id}
            anchorX={stickerTarget.anchorX}
            anchorY={stickerTarget.anchorY}
            onCreated={(sticker) =>
              onMementoSaved?.({ id: sm.id, stickers: [...(sm.stickers ?? []), sticker] })
            }
            onNoteCreated={(note) => onMementoRestored?.(note)}
            onClose={() => setStickerTarget(null)}
          />
        );
      })()}

      {pendingDelete && (
        <div className={styles.undoBar} role="status">
          <span>Pin removed</span>
          <button onClick={undoDelete}>Undo</button>
        </div>
      )}

      {arrangeMode && selectedMemento && (
        <div className={styles.rotateBar}>
          <div className={styles.rotateLabel}>Rotate</div>
          <input
            type="range"
            min="-45"
            max="45"
            step="1"
            value={selectedRotation}
            onChange={(e) => setRotation(selectedId, Number(e.target.value))}
            className={styles.rotateSlider}
          />
          <div className={styles.rotateValue}>{Math.round(selectedRotation)}°</div>
          <button
            className={styles.rotateReset}
            onClick={() => setRotation(selectedId, 0)}
            aria-label="Reset rotation"
            title="Reset rotation"
          >
            Reset
          </button>
        </div>
      )}
    </>
  );
}
