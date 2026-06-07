// ====================================================================
// WHATSPLAN — ReviewService.js
// ====================================================================
import { getSupabase } from '/src/services/SupabaseService.js';

export const ReviewService = {

  async getForPlace(placeId) {
    const { data, error } = await getSupabase()
      .from('place_reviews')
      .select('id, rating, text, created_at, user_id, display_name, avatar_url')
      .eq('place_id', String(placeId))
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
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

  async upsert(placeId, userId, rating, text, displayName, avatarUrl) {
    const { error } = await getSupabase()
      .from('place_reviews')
      .upsert({
        place_id:     String(placeId),
        user_id:      userId,
        rating,
        text,
        display_name: displayName || null,
        avatar_url:   avatarUrl   || null,
        updated_at:   new Date().toISOString()
      }, { onConflict: 'place_id,user_id' });
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
