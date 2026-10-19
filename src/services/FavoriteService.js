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

  // Cuántas personas guardaron el lugar (función place_save_count en
  // place_save_count.sql: devuelve solo el número, no quiénes)
  async getSaveCount(placeId) {
    const { data, error } = await getSupabase()
      .rpc('place_save_count', { p_place_id: String(placeId) });
    if (error) throw error;
    return Number(data) || 0;
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

  // ── Perfil ──────────────────────────────────────────────────────────
  // Todos mis lugares guardados (ids, del más reciente al más viejo)
  async getFavoriteIds(userId) {
    const { data, error } = await getSupabase()
      .from('place_favorites')
      .select('place_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => r.place_id);
  },

  // Colecciones de un usuario con sus lugares → [{ id, name, emoji,
  // is_public, items: [place_id…] }]. De otra persona, las reglas de
  // Supabase solo dejan ver las públicas. Si aún no se corrió
  // profile_social.sql (sin is_public) se piden sin esa columna.
  async getProfileCollections(userId) {
    const q = (cols, withPos) => {
      let r = getSupabase()
        .from('place_collections')
        .select(`${cols}, place_collection_items(place_id, added_at)`)
        .eq('user_id', userId);
      if (withPos) r = r.order('position', { ascending: true, nullsFirst: false });
      return r.order('created_at', { ascending: true });
    };
    let { data, error } = await q('id, name, emoji, is_public, created_at', true);
    if (error && /is_public|position/i.test(error.message || '')) ({ data, error } = await q('id, name, emoji, created_at', false));
    if (error) throw error;
    return (data || []).map(c => ({
      id: c.id, name: c.name, emoji: c.emoji || null, is_public: !!c.is_public,
      items: (c.place_collection_items || [])
        .slice().sort((a, b) => String(b.added_at || '').localeCompare(String(a.added_at || '')))
        .map(i => i.place_id),
    }));
  },

  async setCollectionPublic(collectionId, isPublic) {
    const { error } = await getSupabase()
      .from('place_collections')
      .update({ is_public: !!isPublic })
      .eq('id', collectionId);
    if (error) throw error;
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
