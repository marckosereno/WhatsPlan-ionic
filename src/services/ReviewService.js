// ====================================================================
// WHATSPLAN — ReviewService.js
// Reseñas de la comunidad en Supabase
// ====================================================================
import { getSupabase } from '/src/services/SupabaseService.js';

export const ReviewService = {

  async getForPlace(placeId) {
    const { data, error } = await getSupabase()
      .from('place_reviews')
      .select('id, rating, text, created_at, user_id')
      .eq('place_id', String(placeId))
      .order('created_at', { ascending: false });
    if (error) throw error;
    // Enriquecer con nombre del perfil si existe
    const rows = data || [];
    for (const row of rows) {
      try {
        const { data: profile } = await getSupabase()
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('id', row.user_id)
          .maybeSingle();
        row.profiles = profile;
      } catch(_) { row.profiles = null; }
    }
    return rows;
  },

  async getUserReview(placeId, userId) {
    const { data } = await getSupabase()
      .from('place_reviews')
      .select('*')
      .eq('place_id', String(placeId))
      .eq('user_id', userId)
      .maybeSingle();
    return data;
  },

  async upsert(placeId, userId, rating, text) {
    const { error } = await getSupabase()
      .from('place_reviews')
      .upsert(
        { place_id: String(placeId), user_id: userId, rating, text, updated_at: new Date().toISOString() },
        { onConflict: 'place_id,user_id' }
      );
    if (error) throw error;
  },

  async delete(placeId, userId) {
    const { error } = await getSupabase()
      .from('place_reviews')
      .delete()
      .eq('place_id', String(placeId))
      .eq('user_id', userId);
    if (error) throw error;
  }
};
