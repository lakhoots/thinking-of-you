import { supabase } from './supabase';

// Hard cap on a sticker caption — past this it wants to be a note.
export const STICKER_CAPTION_MAX = 60;

export const STICKER_COLS =
  'id, memento_id, author_id, emoji, caption, anchor_x, anchor_y, rotation, created_at';

// The handmade tilt: random ±5°, set once at creation and persisted so the
// sticker looks identical to both partners forever.
export function pickStickerRotation() {
  return (Math.random() - 0.5) * 10;
}

export async function fetchStickers(mementoId) {
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
  const { error } = await supabase.from('stickers').delete().eq('id', stickerId);
  if (error) throw error;
}
