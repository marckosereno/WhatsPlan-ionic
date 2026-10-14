// ====================================================================
// WHATSPLAN — ReviewService.js
// ====================================================================
import { getSupabase }       from '/src/services/SupabaseService.js';
import { getOrGenerateAvatar } from '/src/services/AvatarService.js';

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

  async upsert(placeId, userId, rating, text, displayName, existingAvatarUrl) {
    // Generar o mantener avatar
    const { url: avatarUrl, isNew } = getOrGenerateAvatar(displayName, existingAvatarUrl);

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

    // Si es un avatar nuevo y el perfil existe, guardarlo también en profiles
    if (isNew && avatarUrl) {
      try {
        await getSupabase()
          .from('profiles')
          .upsert({ id: userId, avatar_url: avatarUrl }, { onConflict: 'id' });
      } catch(_) { /* profiles puede no existir, no es crítico */ }
    }

    return avatarUrl;
  },

  async delete(placeId, userId) {
    const { error } = await getSupabase()
      .from('place_reviews')
      .delete()
      .eq('place_id', String(placeId))
      .eq('user_id', userId);
    if (error) throw error;
  },

  // ── REACCIONES Y RESPUESTAS ────────────────────────────────────────
  // Tablas: review_reactions y review_replies (ver review_social.sql).
  // Cada reseña se identifica con un review_key de texto:
  //   'wp:<id>'                 → reseña de WhatsPlan (place_reviews.id)
  //   'g:<placeId>:<hash>'      → reseña de Google (no tiene id propio)

  // Trae TODAS las reacciones y respuestas de un lugar en 2 consultas;
  // la ficha las agrupa por review_key del lado del cliente.
  async getSocialForPlace(placeId) {
    const sb = getSupabase();
    const pid = String(placeId);
    const [reactRes, replyRes] = await Promise.all([
      sb.from('review_reactions')
        .select('review_key, user_id, type')
        .eq('place_id', pid),
      sb.from('review_replies')
        .select('id, review_key, user_id, display_name, avatar_url, text, created_at')
        .eq('place_id', pid)
        .order('created_at', { ascending: true }),
    ]);
    if (reactRes.error) throw reactRes.error;
    if (replyRes.error) throw replyRes.error;
    return { reactions: reactRes.data || [], replies: replyRes.data || [] };
  },

  // "Útil" — on=true lo marca, on=false lo quita
  async setUseful(reviewKey, placeId, userId, on) {
    const sb = getSupabase();
    if (on) {
      const { error } = await sb.from('review_reactions').upsert(
        { review_key: reviewKey, place_id: String(placeId), user_id: userId, type: 'util' },
        { onConflict: 'review_key,user_id,type', ignoreDuplicates: true }
      );
      if (error) throw error;
    } else {
      const { error } = await sb.from('review_reactions').delete()
        .eq('review_key', reviewKey).eq('user_id', userId).eq('type', 'util');
      if (error) throw error;
    }
  },

  // Reacción con emoji — una sola por usuario y reseña (estilo Tapback).
  // type=null la quita. Cambiar de emoji borra la anterior y pone la nueva.
  async setEmoji(reviewKey, placeId, userId, type) {
    const sb = getSupabase();
    const { error: delErr } = await sb.from('review_reactions').delete()
      .eq('review_key', reviewKey).eq('user_id', userId).neq('type', 'util');
    if (delErr) throw delErr;
    if (!type) return;
    const { error } = await sb.from('review_reactions').insert(
      { review_key: reviewKey, place_id: String(placeId), user_id: userId, type }
    );
    if (error) throw error;
  },

  async addReply(reviewKey, placeId, userId, text, displayName, avatarUrl) {
    const { data, error } = await getSupabase()
      .from('review_replies')
      .insert({
        review_key:   reviewKey,
        place_id:     String(placeId),
        user_id:      userId,
        text,
        display_name: displayName || null,
        avatar_url:   avatarUrl   || null,
      })
      .select('id, review_key, user_id, display_name, avatar_url, text, created_at')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteReply(replyId, userId) {
    const { error } = await getSupabase()
      .from('review_replies')
      .delete()
      .eq('id', replyId)
      .eq('user_id', userId);
    if (error) throw error;
  }
};
