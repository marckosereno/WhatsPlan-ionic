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
    // Orden: el que eligió el usuario (position) y, sin orden, por fecha.
    // Si aún no se corrió el SQL que agrega "position", se pide sin ella.
    const q = (withPos) => {
      let r = getSupabase()
        .from('place_collections')
        .select('id, name, emoji, created_at, place_collection_items(place_id)')
        .eq('user_id', userId);
      if (withPos) r = r.order('position', { ascending: true, nullsFirst: false });
      return r.order('created_at', { ascending: true });
    };
    let { data, error } = await q(true);
    if (error && /position/i.test(error.message || '')) ({ data, error } = await q(false));
    if (error) throw error;
    const pid = String(placeId);
    return (data || []).map(c => {
      const items = c.place_collection_items || [];
      return { id: c.id, name: c.name, emoji: c.emoji || null, count: items.length, has: items.some(i => i.place_id === pid) };
    });
  },

  async createCollection(userId, name, emoji = null) {
    const { data, error } = await getSupabase()
      .from('place_collections')
      .insert({ user_id: userId, name: name.trim().slice(0, 60), emoji: emoji || null })
      .select('id, name, emoji')
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

  async updateCollection(collectionId, { name, emoji }) {
    const { error } = await getSupabase()
      .from('place_collections')
      .update({ name: name.trim().slice(0, 60), emoji: emoji || null })
      .eq('id', collectionId);
    if (error) throw error;
  },

  // Guarda el orden de las colecciones (ids en el orden nuevo)
  async reorderCollections(ids) {
    const sb = getSupabase();
    const res = await Promise.all(ids.map((id, i) =>
      sb.from('place_collections').update({ position: i }).eq('id', id)));
    const bad = res.find(r => r.error);
    if (bad) throw bad.error;
  },

  // Borra la colección; sus lugares se quitan solos (on delete cascade).
  // Los lugares siguen en favoritos.
  async deleteCollection(collectionId) {
    const { error } = await getSupabase()
      .from('place_collections')
      .delete()
      .eq('id', collectionId);
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
