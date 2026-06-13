import { supabase } from './supabase';
import { compressImageWithThumb, extForMime } from './image';

export async function listSparks(partnershipId) {
  let { data, error } = await supabase
    .from('sparks')
    .select('*, photos:spark_photos(id, image_url, thumb_url, position), comments:spark_comments(id, spark_id, author_id, body, created_at), views:spark_views(id, spark_id, user_id, seen_at)')
    .eq('partnership_id', partnershipId)
    .order('created_at', { ascending: false });

  if (error && (
    error.code === 'PGRST200' ||
    error.code === '42P01' ||
    error.message?.includes('spark_comments') ||
    error.message?.includes('spark_views')
  )) {
    const fallback = await supabase
      .from('sparks')
      .select('*, photos:spark_photos(id, image_url, thumb_url, position), comments:spark_comments(id, spark_id, author_id, body, created_at)')
      .eq('partnership_id', partnershipId)
      .order('created_at', { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }

  if (error && (
    error.code === 'PGRST200' ||
    error.code === '42P01' ||
    error.message?.includes('spark_comments')
  )) {
    const fallback = await supabase
      .from('sparks')
      .select('*, photos:spark_photos(id, image_url, thumb_url, position)')
      .eq('partnership_id', partnershipId)
      .order('created_at', { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;
  return (data ?? []).map((s) => ({
    ...s,
    photos: (s.photos ?? []).slice().sort((a, b) => a.position - b.position),
    comments: (s.comments ?? []).slice().sort((a, b) =>
      (a.created_at < b.created_at ? 1 : -1),
    ),
    views: (s.views ?? []).slice().sort((a, b) =>
      (a.seen_at < b.seen_at ? 1 : -1),
    ),
  }));
}

export async function fetchSparkPhotos(sparkId) {
  const { data, error } = await supabase
    .from('spark_photos')
    .select('id, image_url, thumb_url, position')
    .eq('spark_id', sparkId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function uploadPhotos(partnershipId, files) {
  const uploaded = [];
  for (const file of files) {
    const { blob, thumbBlob } = await compressImageWithThumb(file);
    const ext = extForMime(blob.type);
    const base = `${partnershipId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const path = `${base}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('sparks')
      .upload(path, blob, { contentType: blob.type, upsert: false });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from('sparks').getPublicUrl(path);

    // The thumbnail is optional — if it didn't generate or fails to upload,
    // post the full image with no thumb_url and let the UI fall back to it.
    let thumbUrl = null;
    if (thumbBlob) {
      const thumbPath = `${base}-thumb.${ext}`;
      const { error: thumbErr } = await supabase.storage
        .from('sparks')
        .upload(thumbPath, thumbBlob, { contentType: thumbBlob.type, upsert: false });
      if (thumbErr) {
        console.warn('spark thumbnail upload failed; using full image', thumbErr);
      } else {
        thumbUrl = supabase.storage.from('sparks').getPublicUrl(thumbPath).data.publicUrl;
      }
    }
    uploaded.push({ url: pub.publicUrl, thumbUrl });
  }
  return uploaded;
}

export async function createSpark({
  partnershipId,
  authorId,
  note,
  date,
  photoFiles,
}) {
  const files = Array.isArray(photoFiles) ? photoFiles : (photoFiles ? [photoFiles] : []);
  const uploaded = await uploadPhotos(partnershipId, files);

  const { data: spark, error } = await supabase
    .from('sparks')
    .insert({
      partnership_id: partnershipId,
      author_id: authorId,
      note: note.trim(),
      date,
      image_url: uploaded[0]?.url ?? null,
      thumb_url: uploaded[0]?.thumbUrl ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  let photos = [];
  if (uploaded.length) {
    const rows = uploaded.map((u, i) => ({
      spark_id: spark.id,
      image_url: u.url,
      thumb_url: u.thumbUrl,
      position: i,
    }));
    const { data: photoRows, error: pErr } = await supabase
      .from('spark_photos')
      .insert(rows)
      .select('id, image_url, thumb_url, position');
    if (pErr) throw pErr;
    photos = (photoRows ?? []).slice().sort((a, b) => a.position - b.position);
  }
  return { ...spark, photos };
}

// Update a spark's text fields and (optionally) its photo stack.
// `newPhotoFiles` are new files to upload; `keepPhotoIds` are the
// existing spark_photos.id values to retain. Final order: keepPhotoIds
// first, then newly uploaded files.
export async function updateSpark({
  sparkId,
  partnershipId,
  patch,
  keepPhotoIds,
  newPhotoFiles,
}) {
  const uploaded = await uploadPhotos(partnershipId, newPhotoFiles ?? []);

  if (keepPhotoIds) {
    const { data: existing, error: exErr } = await supabase
      .from('spark_photos')
      .select('id')
      .eq('spark_id', sparkId);
    if (exErr) throw exErr;
    const dropIds = (existing ?? [])
      .map((r) => r.id)
      .filter((id) => !keepPhotoIds.includes(id));
    if (dropIds.length) {
      const { error: dErr } = await supabase
        .from('spark_photos')
        .delete()
        .in('id', dropIds);
      if (dErr) throw dErr;
    }
    for (let i = 0; i < keepPhotoIds.length; i++) {
      const { error: uErr } = await supabase
        .from('spark_photos')
        .update({ position: i })
        .eq('id', keepPhotoIds[i]);
      if (uErr) throw uErr;
    }
  }

  if (uploaded.length) {
    const startPos = keepPhotoIds?.length ?? 0;
    const rows = uploaded.map((u, i) => ({
      spark_id: sparkId,
      image_url: u.url,
      thumb_url: u.thumbUrl,
      position: startPos + i,
    }));
    const { error: pErr } = await supabase.from('spark_photos').insert(rows);
    if (pErr) throw pErr;
  }

  const photos = await fetchSparkPhotos(sparkId);
  const finalPatch = { ...patch };
  if (keepPhotoIds || uploaded.length) {
    finalPatch.image_url = photos[0]?.image_url ?? null;
    finalPatch.thumb_url = photos[0]?.thumb_url ?? null;
  }

  const { data: updated, error: sErr } = await supabase
    .from('sparks')
    .update(finalPatch)
    .eq('id', sparkId)
    .select()
    .single();
  if (sErr) throw sErr;

  return { ...updated, photos };
}

export async function deleteSpark(sparkId) {
  // spark_photos cascades via FK.
  const { error } = await supabase.from('sparks').delete().eq('id', sparkId);
  if (error) throw error;
}

export async function createSparkComment({ sparkId, authorId, body }) {
  const { data, error } = await supabase
    .from('spark_comments')
    .insert({
      spark_id: sparkId,
      author_id: authorId,
      body: body.trim(),
    })
    .select('id, spark_id, author_id, body, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function markSparkSeen({ sparkId, userId }) {
  const { data, error } = await supabase
    .from('spark_views')
    .upsert(
      {
        spark_id: sparkId,
        user_id: userId,
        seen_at: new Date().toISOString(),
      },
      { onConflict: 'spark_id,user_id' },
    )
    .select('id, spark_id, user_id, seen_at')
    .single();
  if (error) throw error;
  return data;
}
