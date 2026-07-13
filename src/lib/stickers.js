import { supabase } from './supabase';
import { STICKERS_DEMO } from './flags';

// Hard cap on a sticker caption — past this it wants to be a note.
export const STICKER_CAPTION_MAX = 60;

// ── Demo mode ─────────────────────────────────────────────────────────
// With VITE_FEATURE_STICKERS=demo, stickers never touch the database:
// they live in localStorage, keyed by memento id, so the mechanics can be
// previewed on the real board before the migration ships. Same shapes as
// the real rows, so every component behaves identically.

const DEMO_KEY = 'mmtoy-demo-stickers';

function demoRead() {
  try {
    const raw = JSON.parse(localStorage.getItem(DEMO_KEY) ?? '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function demoWrite(all) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function demoStickersFor(mementoId) {
  return demoRead()[mementoId] ?? [];
}

export const STICKER_COLS =
  'id, memento_id, author_id, emoji, caption, anchor_x, anchor_y, rotation, created_at';

// The handmade tilt: random ±5°, set once at creation and persisted so the
// sticker looks identical to both partners forever.
export function pickStickerRotation() {
  return (Math.random() - 0.5) * 10;
}

// Put the sticker where the long-press happened. A small inset keeps the
// bubble's tail attached to the card instead of landing outside the face.
const ANCHOR_INSET = 0.08;

export function pickStickerAnchor(pressX, pressY) {
  const clamp = (n) => Math.max(ANCHOR_INSET, Math.min(1 - ANCHOR_INSET, n));
  return { x: clamp(pressX), y: clamp(pressY) };
}

export async function fetchStickers(mementoId) {
  if (STICKERS_DEMO) return demoStickersFor(mementoId);
  const { data, error } = await supabase
    .from('stickers')
    .select(STICKER_COLS)
    .eq('memento_id', mementoId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createSticker({
  mementoId,
  authorId,
  emoji,
  caption,
  anchorX,
  anchorY,
}) {
  const trimmedCaption = caption?.trim() || null;
  if (trimmedCaption && trimmedCaption.length > STICKER_CAPTION_MAX) {
    throw new Error(`Sticker captions max out at ${STICKER_CAPTION_MAX} characters`);
  }
  if (STICKERS_DEMO) {
    const sticker = {
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      memento_id: mementoId,
      author_id: authorId,
      emoji,
      caption: trimmedCaption,
      anchor_x: Math.max(0, Math.min(1, anchorX)),
      anchor_y: Math.max(0, Math.min(1, anchorY)),
      rotation: pickStickerRotation(),
      created_at: new Date().toISOString(),
    };
    const all = demoRead();
    all[mementoId] = [...(all[mementoId] ?? []), sticker];
    demoWrite(all);
    return sticker;
  }
  const { data, error } = await supabase
    .from('stickers')
    .insert({
      memento_id: mementoId,
      author_id: authorId,
      emoji,
      caption: trimmedCaption,
      anchor_x: Math.max(0, Math.min(1, anchorX)),
      anchor_y: Math.max(0, Math.min(1, anchorY)),
      rotation: pickStickerRotation(),
    })
    .select(STICKER_COLS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSticker(stickerId) {
  if (STICKERS_DEMO) {
    const all = demoRead();
    for (const mid of Object.keys(all)) {
      all[mid] = all[mid].filter((s) => s.id !== stickerId);
      if (all[mid].length === 0) delete all[mid];
    }
    demoWrite(all);
    return;
  }
  const { error } = await supabase.from('stickers').delete().eq('id', stickerId);
  if (error) throw error;
}
