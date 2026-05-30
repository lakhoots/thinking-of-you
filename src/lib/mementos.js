import { supabase } from './supabase';
import { compressImageWithThumb, extForMime } from './image';

const BOARD_W = 3200;
const BOARD_H = 2600;
const CARD_W = 138;
const CARD_H = 170;
const PIN_PAD_X = 0.018;
const PIN_PAD_Y = 0.024;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function uploadMementoPhoto(partnershipId, file) {
  const { blob, thumbBlob, hasTransparency } = await compressImageWithThumb(file);
  const ext = extForMime(blob.type);
  const base = `${partnershipId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${base}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('mementos')
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from('mementos').getPublicUrl(path);

  // The thumbnail is optional — if it didn't generate or fails to upload,
  // post the full image with no thumb_url and let the UI fall back to it.
  let thumbUrl = null;
  if (thumbBlob) {
    const thumbPath = `${base}-thumb.${ext}`;
    const { error: thumbErr } = await supabase.storage
      .from('mementos')
      .upload(thumbPath, thumbBlob, { contentType: thumbBlob.type, upsert: false });
    if (thumbErr) {
      console.warn('memento thumbnail upload failed; using full image', thumbErr);
    } else {
      thumbUrl = supabase.storage.from('mementos').getPublicUrl(thumbPath).data.publicUrl;
    }
  }
  return { url: pub.publicUrl, thumbUrl, hasTransparency };
}

function pinRectAt(x, y, m = {}) {
  const scaleX = m.scale ?? 1;
  const scaleY = m.type === 'note' ? (m.scale_y ?? scaleX) : scaleX;
  const rotation = ((m.rotation ?? 0) * Math.PI) / 180;
  const w = (CARD_W * scaleX) / BOARD_W;
  const h = (CARD_H * scaleY) / BOARD_H;
  const cos = Math.abs(Math.cos(rotation));
  const sin = Math.abs(Math.sin(rotation));
  const halfW = ((w * cos) + (h * sin)) / 2 + PIN_PAD_X;
  const halfH = ((w * sin) + (h * cos)) / 2 + PIN_PAD_Y;
  return {
    minX: x - halfW,
    maxX: x + halfW,
    minY: y - halfH,
    maxY: y + halfH,
  };
}

function rectOverlapArea(a, b) {
  const w = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const h = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  return w * h;
}

function rectDistance(a, b) {
  const dx = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX));
  const dy = Math.max(0, Math.max(a.minY - b.maxY, b.minY - a.maxY));
  return Math.hypot(dx, dy);
}

// Pick a position for a new memento in normalized (0–1, 0–1) coords.
// If a visible board rect is provided, prefer the most spacious point inside
// the current zoomed area; when crowded, pick the least-covering overlap.
export function pickPosition(existing, minSpacing = 0.08, visibleRect = null, type = 'photo') {
  if (visibleRect) {
    const marginX = (CARD_W / BOARD_W) / 2 + PIN_PAD_X;
    const marginY = (CARD_H / BOARD_H) / 2 + PIN_PAD_Y;
    const rect = {
      minX: clamp(visibleRect.minX + marginX, 0.05, 0.95),
      maxX: clamp(visibleRect.maxX - marginX, 0.05, 0.95),
      minY: clamp(visibleRect.minY + marginY, 0.05, 0.95),
      maxY: clamp(visibleRect.maxY - marginY, 0.05, 0.95),
    };

    if (rect.minX <= rect.maxX && rect.minY <= rect.maxY) {
      const existingRects = existing.map((m) => pinRectAt(m.pos_x, m.pos_y, m));
      let best = null;
      const candidates = [];
      const stepsX = 7;
      const stepsY = 7;

      for (let ix = 0; ix < stepsX; ix++) {
        for (let iy = 0; iy < stepsY; iy++) {
          candidates.push({
            x: rect.minX + ((ix + 0.5) / stepsX) * (rect.maxX - rect.minX),
            y: rect.minY + ((iy + 0.5) / stepsY) * (rect.maxY - rect.minY),
          });
        }
      }
      for (let i = 0; i < 90; i++) {
        candidates.push({
          x: rect.minX + Math.random() * (rect.maxX - rect.minX),
          y: rect.minY + Math.random() * (rect.maxY - rect.minY),
        });
      }

      for (const c of candidates) {
        for (const rotation of [-7, -4, 0, 4, 7]) {
          const candidateRect = pinRectAt(c.x, c.y, { type, scale: 1, scale_y: 1, rotation });
          const overlap = existingRects.reduce((sum, r) => sum + rectOverlapArea(candidateRect, r), 0);
          const nearest = existingRects.length
            ? Math.min(...existingRects.map((r) => rectDistance(candidateRect, r)))
            : 1;
          const centerBias = Math.hypot(c.x - ((rect.minX + rect.maxX) / 2), c.y - ((rect.minY + rect.maxY) / 2));
          const rotationBias = Math.abs(rotation) * 0.0002;
          const score = overlap * 1000 - nearest + centerBias * 0.02 + rotationBias;
          if (!best || score < best.score) best = { ...c, rotation, score, overlap, nearest };
        }
      }

      if (best) return { x: best.x, y: best.y, rotation: best.rotation };
    }
  }

  // Spread outward from the centre as the board fills up.
  const spread = 0.04 + existing.length * 0.025;
  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.02 + Math.random() * spread;
    const x = 0.5 + Math.cos(angle) * dist;
    const y = 0.5 + Math.sin(angle) * dist;
    if (x < 0.05 || x > 0.95 || y < 0.05 || y > 0.95) continue;
    const tooClose = existing.some((m) => {
      const dx = m.pos_x - x;
      const dy = m.pos_y - y;
      return Math.hypot(dx, dy) < minSpacing;
    });
    if (!tooClose) return { x, y };
  }
  // Give up and place somewhere reasonable.
  return {
    x: Math.max(0.1, Math.min(0.9, 0.5 + (Math.random() - 0.5) * 0.3)),
    y: Math.max(0.1, Math.min(0.9, 0.5 + (Math.random() - 0.5) * 0.25)),
  };
}

export function pickRotation() {
  return (Math.random() - 0.5) * 12; // -6° to +6°
}

export async function listMementos(partnershipId) {
  const { data, error } = await supabase
    .from('mementos')
    .select('*, photos:memento_photos(id, image_url, thumb_url, position, has_transparency)')
    .eq('partnership_id', partnershipId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    ...m,
    photos: (m.photos ?? []).slice().sort((a, b) => a.position - b.position),
  }));
}

export async function fetchMementoPhotos(mementoId) {
  const { data, error } = await supabase
    .from('memento_photos')
    .select('id, image_url, thumb_url, position, has_transparency')
    .eq('memento_id', mementoId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Update a memento's text fields and (optionally) its photo stack.
// `newPhotoFiles` is an array of File objects to upload as additional
// photos; `keepPhotoIds` is the set of existing memento_photos.id values
// to retain (others get deleted). Final ordering is keepPhotoIds first
// (in given order), then newly uploaded files.
export async function updateMemento({
  mementoId,
  partnershipId,
  patch,
  keepPhotoIds,
  newPhotoFiles,
}) {
  // 1. Upload any new files.
  const uploaded = [];
  for (const file of newPhotoFiles ?? []) {
    uploaded.push(await uploadMementoPhoto(partnershipId, file));
  }

  // 2. Delete photos the caller dropped.
  if (keepPhotoIds) {
    const { data: existing, error: exErr } = await supabase
      .from('memento_photos')
      .select('id')
      .eq('memento_id', mementoId);
    if (exErr) throw exErr;
    const dropIds = (existing ?? [])
      .map((r) => r.id)
      .filter((id) => !keepPhotoIds.includes(id));
    if (dropIds.length) {
      const { error: dErr } = await supabase
        .from('memento_photos')
        .delete()
        .in('id', dropIds);
      if (dErr) throw dErr;
    }
  }

  // 3. Reposition kept photos so order matches the caller's intent, then
  //    append uploads after them.
  if (keepPhotoIds) {
    for (let i = 0; i < keepPhotoIds.length; i++) {
      const { error: uErr } = await supabase
        .from('memento_photos')
        .update({ position: i })
        .eq('id', keepPhotoIds[i]);
      if (uErr) throw uErr;
    }
  }
  if (uploaded.length) {
    const startPos = (keepPhotoIds?.length ?? 0);
    const rows = uploaded.map((u, i) => ({
      memento_id: mementoId,
      image_url: u.url,
      thumb_url: u.thumbUrl,
      position: startPos + i,
      has_transparency: u.hasTransparency,
    }));
    const { error: pErr } = await supabase.from('memento_photos').insert(rows);
    if (pErr) throw pErr;
  }

  // 4. Refresh the photo list and set the cover (image_url) + transparency
  //    flag to whatever is now at position 0.
  const photos = await fetchMementoPhotos(mementoId);
  const finalPatch = { ...patch };
  if (keepPhotoIds || uploaded.length) {
    finalPatch.image_url = photos[0]?.image_url ?? null;
    finalPatch.thumb_url = photos[0]?.thumb_url ?? null;
    finalPatch.has_transparency = photos[0]?.has_transparency ?? false;
  }

  const { data: updated, error: mErr } = await supabase
    .from('mementos')
    .update(finalPatch)
    .eq('id', mementoId)
    .select()
    .single();
  if (mErr) throw mErr;

  return { ...updated, photos };
}

export async function deleteMemento(mementoId) {
  // memento_photos cascades on delete via the FK.
  const { error } = await supabase.from('mementos').delete().eq('id', mementoId);
  if (error) throw error;
}

// Batch-move pins. Either partner may call this — backed by the
// move_mementos SECURITY DEFINER RPC, which only touches pos_x/pos_y/rotation.
export async function moveMementos(moves) {
  if (!moves.length) return;
  const { error } = await supabase.rpc('move_mementos', { moves });
  if (error) throw error;
}

export async function createMemento({
  partnershipId,
  authorId,
  type,
  date,
  title,
  note,
  emoji,
  photoFile,
  existing,
  visibleRect,
}) {
  // Accept a single file or an array of files for the photo path.
  const photoFiles = type === 'photo'
    ? (Array.isArray(photoFile) ? photoFile : (photoFile ? [photoFile] : []))
    : [];

  const uploaded = [];
  for (const file of photoFiles) {
    uploaded.push(await uploadMementoPhoto(partnershipId, file));
  }

  const placement = pickPosition(existing, 0.08, visibleRect, type);
  const { x, y } = placement;
  const rotation = placement.rotation ?? pickRotation();

  const { data: memento, error } = await supabase
    .from('mementos')
    .insert({
      partnership_id: partnershipId,
      author_id: authorId,
      type,
      date,
      title: title || null,
      note: note || null,
      image_url: uploaded[0]?.url ?? null, // cover (denormalized) for fast board render
      thumb_url: uploaded[0]?.thumbUrl ?? null, // small cover for the board pin
      emoji: emoji || null,
      pos_x: x,
      pos_y: y,
      rotation,
      has_transparency: uploaded[0]?.hasTransparency ?? false,
    })
    .select()
    .single();
  if (error) throw error;

  let photos = [];
  if (uploaded.length) {
    const rows = uploaded.map((u, i) => ({
      memento_id: memento.id,
      image_url: u.url,
      thumb_url: u.thumbUrl,
      position: i,
      has_transparency: u.hasTransparency,
    }));
    const { data: photoRows, error: pErr } = await supabase
      .from('memento_photos')
      .insert(rows)
      .select('id, image_url, thumb_url, position, has_transparency');
    if (pErr) throw pErr;
    photos = (photoRows ?? []).slice().sort((a, b) => a.position - b.position);
  }
  return { ...memento, photos };
}
