import { supabase } from './supabase';
import { makeThumbnail } from './image';

// One-time, in-app backfill of thumbnails for photos uploaded before
// thumb_url existed. Runs in the browser: downloads each full image,
// regenerates a small thumbnail, uploads it next to the original, and
// writes thumb_url back. RLS limits writes to photos the current user
// authored, so each partner backfills their own content; everything else
// keeps falling back to the full image_url until then.

function storagePathFromPublicUrl(url, bucket) {
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}

function thumbPathFor(path) {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? `${path}-thumb` : `${path.slice(0, dot)}-thumb${path.slice(dot)}`;
}

async function generateThumbUrl(bucket, imageUrl) {
  const path = storagePathFromPublicUrl(imageUrl, bucket);
  if (!path) return null;
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const thumbBlob = await makeThumbnail(await res.blob());
  const thumbPath = thumbPathFor(path);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(thumbPath, thumbBlob, { contentType: thumbBlob.type, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(thumbPath);
  return data.publicUrl;
}

// Walk a parent's photos, backfilling any that lack a thumb. When the
// cover photo (matching parent.image_url) gets a thumb, mirror it onto the
// parent's denormalized thumb_url so the board/feed fast path picks it up.
async function backfillParent({ parent, bucket, photoTable, parentTable }) {
  for (const p of parent.photos ?? []) {
    if (p.thumb_url || !p.image_url || p.id === 'cover') continue;
    try {
      const thumbUrl = await generateThumbUrl(bucket, p.image_url);
      if (!thumbUrl) continue;
      await supabase.from(photoTable).update({ thumb_url: thumbUrl }).eq('id', p.id);
      p.thumb_url = thumbUrl;
      if (p.image_url === parent.image_url) {
        await supabase.from(parentTable).update({ thumb_url: thumbUrl }).eq('id', parent.id);
        parent.thumb_url = thumbUrl;
      }
    } catch (err) {
      console.warn(`thumb backfill (${parentTable})`, p.id, err);
    }
  }
}

export async function backfillThumbnails({ mementos, sparks, currentUserId }) {
  if (!currentUserId) return;
  for (const m of mementos ?? []) {
    if (m.author_id !== currentUserId) continue;
    await backfillParent({
      parent: m,
      bucket: 'mementos',
      photoTable: 'memento_photos',
      parentTable: 'mementos',
    });
  }
  for (const s of sparks ?? []) {
    if (s.author_id !== currentUserId) continue;
    await backfillParent({
      parent: s,
      bucket: 'sparks',
      photoTable: 'spark_photos',
      parentTable: 'sparks',
    });
  }
}
