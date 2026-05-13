import { supabase } from './supabase';
import { compressImage } from './image';

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
    .select('*')
    .eq('partnership_id', partnershipId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
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
  let imageUrl = null;
  if (type === 'photo' && photoFile) {
    const blob = await compressImage(photoFile);
    const path = `${partnershipId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error: upErr } = await supabase.storage
      .from('mementos')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from('mementos').getPublicUrl(path);
    imageUrl = pub.publicUrl;
  }

  const { x, y } = pickPosition(existing);
  const rotation = pickRotation();

  const { data, error } = await supabase
    .from('mementos')
    .insert({
      partnership_id: partnershipId,
      author_id: authorId,
      type,
      date,
      title: title || null,
      note: note || null,
      image_url: imageUrl,
      emoji: emoji || null,
      pos_x: x,
      pos_y: y,
      rotation,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
