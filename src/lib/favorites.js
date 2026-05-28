import { supabase } from './supabase';

// Favorites are INSERT-only from the app. Every entry is preserved so a
// future "replay" feature can show the history of favorites over time
// and surface themes. Do not add update/delete here without revisiting
// that design.

export async function listFavorites(partnershipId) {
  const { data, error } = await supabase
    .from('favorites')
    .select('*')
    .eq('partnership_id', partnershipId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createFavorite({ partnershipId, authorId, body }) {
  const { data, error } = await supabase
    .from('favorites')
    .insert({
      partnership_id: partnershipId,
      author_id: authorId,
      body: body.trim(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
