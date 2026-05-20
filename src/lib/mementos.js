import { supabase } from './supabase';
import { compressImageDetailed, extForMime } from './image';

// Pick a position for a new memento in normalized (0–1, 0–1) coords.
// Tries to stay at least `minSpacing` away from existing items; falls back
// to a jittered spot near the centre after enough failed attempts.
export function pickPosition(existing, minSpacing = 0.08) {
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
    .select('*, photos:memento_photos(id, image_url, position, has_transparency)')
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
    .select('id, image_url, position, has_transparency')
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
    const { blob, hasTransparency } = await compressImageDetailed(file);
    const ext = extForMime(blob.type);
    const path = `${partnershipId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('mementos')
      .upload(path, blob, { contentType: blob.type, upsert: false });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from('mementos').getPublicUrl(path);
    uploaded.push({ url: pub.publicUrl, hasTransparency });
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
}) {
  // Accept a single file or an array of files for the photo path.
  const photoFiles = type === 'photo'
    ? (Array.isArray(photoFile) ? photoFile : (photoFile ? [photoFile] : []))
    : [];

  const uploaded = [];
  for (const file of photoFiles) {
    const { blob, hasTransparency } = await compressImageDetailed(file);
    const ext = extForMime(blob.type);
    const path = `${partnershipId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('mementos')
      .upload(path, blob, { contentType: blob.type, upsert: false });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from('mementos').getPublicUrl(path);
    uploaded.push({ url: pub.publicUrl, hasTransparency });
  }

  const { x, y } = pickPosition(existing);
  const rotation = pickRotation();

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
      position: i,
      has_transparency: u.hasTransparency,
    }));
    const { data: photoRows, error: pErr } = await supabase
      .from('memento_photos')
      .insert(rows)
      .select('id, image_url, position, has_transparency');
    if (pErr) throw pErr;
    photos = (photoRows ?? []).slice().sort((a, b) => a.position - b.position);
  }
  return { ...memento, photos };
}
