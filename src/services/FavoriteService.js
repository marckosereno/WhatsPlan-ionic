// ====================================================================
// WHATSPLAN — FavoriteService.js
// Favoritos y colecciones de lugares (tablas en favorites_collections.sql)
// ====================================================================
import { getSupabase } from '/src/services/SupabaseService.js';

export const FavoriteService = {

  async isFavorite(placeId, userId) {
    const { data, error } = await getSupabase()
      .from('place_favorites')
      .select('place_id')
      .eq('user_id', userId)
      .eq('place_id', String(placeId))
      .maybeSingle();
    if (error) throw error;
    return !!data;
  },

  async add(placeId, userId) {
    const { error } = await getSupabase()
      .from('place_favorites')
      .upsert({ user_id: userId, place_id: String(placeId) }, { onConflict: 'user_id,place_id' });
    if (error) throw error;
  },

  async remove(placeId, userId) {
    const { error } = await getSupabase()
      .from('place_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('place_id', String(placeId));
    if (error) throw error;
  },

  // Colecciones del usuario, con cuántos lugares tiene cada una y si ya
  // incluye este lugar → [{ id, name, count, has }]
  async getCollections(userId, placeId) {
    const { data, error } = await getSupabase()
      .from('place_collections')
      .select('id, name, created_at, place_collection_items(place_id)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const pid = String(placeId);
    return (data || []).map(c => {
      const items = c.place_collection_items || [];
      return { id: c.id, name: c.name, count: items.length, has: items.some(i => i.place_id === pid) };
    });
  },

  async createCollection(userId, name) {
    const { data, error } = await getSupabase()
      .from('place_collections')
      .insert({ user_id: userId, name: name.trim().slice(0, 60) })
      .select('id, name')
      .single();
    if (error) throw error;
    return data;
  },

  async addToCollection(collectionId, placeId) {
    const { error } = await getSupabase()
      .from('place_collection_items')
      .upsert({ collection_id: collectionId, place_id: String(placeId) }, { onConflict: 'collection_id,place_id' });
    if (error) throw error;
  },

  async removeFromCollection(collectionId, placeId) {
    const { error } = await getSupabase()
      .from('place_collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .eq('place_id', String(placeId));
    if (error) throw error;
  },
};
