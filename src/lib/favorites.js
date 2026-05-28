import { supabase } from './supabase';

export async function listFavorites(partnershipId) {
  const { data, error } = await supabase
    .from('favorites')
    .select('*')
    .eq('partnership_id', partnershipId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createFavorite({ partnershipId, authorId, body, date }) {
  const { data, error } = await supabase
    .from('favorites')
    .insert({
      partnership_id: partnershipId,
      author_id: authorId,
      body: body.trim(),
      date,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFavorite({ favoriteId, patch }) {
  const { data, error } = await supabase
    .from('favorites')
    .update(patch)
    .eq('id', favoriteId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFavorite(favoriteId) {
  const { error } = await supabase.from('favorites').delete().eq('id', favoriteId);
  if (error) throw error;
}
