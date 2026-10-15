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
  //   'r:<id>'                  → una respuesta (review_replies.id) — solo
  //                               para reacciones con emoji

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
        .select('id, review_key, user_id, display_name, avatar_url, text, created_at, reply_to_id, reply_to_name, edited_at')
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

  // replyTo (opcional): { id, name } — cuando se responde a OTRA respuesta.
  // Queda en el mismo hilo (mismo review_key), solo guarda a quién se
  // le contestó para mostrar "↳ Luis".
  async addReply(reviewKey, placeId, userId, text, displayName, avatarUrl, replyTo = null) {
    const { data, error } = await getSupabase()
      .from('review_replies')
      .insert({
        review_key:    reviewKey,
        place_id:      String(placeId),
        user_id:       userId,
        text,
        display_name:  displayName || null,
        avatar_url:    avatarUrl   || null,
        reply_to_id:   replyTo?.id   ?? null,
        reply_to_name: replyTo?.name ?? null,
      })
      .select('id, review_key, user_id, display_name, avatar_url, text, created_at, reply_to_id, reply_to_name')
      .single();
    if (error) throw error;
    return data;
  },

  async updateReply(replyId, userId, text) {
    const { data, error } = await getSupabase()
      .from('review_replies')
      .update({ text, edited_at: new Date().toISOString() })
      .eq('id', replyId)
      .eq('user_id', userId)
      .select('id, review_key, user_id, display_name, avatar_url, text, created_at, reply_to_id, reply_to_name, edited_at')
      .single();
    if (error) throw error;
    return data;
  },

  // ── MODERACIÓN ─────────────────────────────────────────────────────
  // Para una ficha: claves ocultas para todos (quitadas por el
  // moderador), lo que ESTE usuario reportó y sigue pendiente (lo ve
  // marcado "En revisión") y los usuarios que bloqueó.
  async getModerationForPlace(placeId, userId) {
    const sb = getSupabase();
    const pid = String(placeId);
    const hiddenP = sb.rpc('get_hidden_review_keys', { p_place_id: pid });
    const mineP = userId
      ? sb.from('review_reports').select('review_key').eq('place_id', pid).eq('reporter_id', userId).eq('status', 'pending')
      : Promise.resolve({ data: [] });
    const blocksP = userId
      ? sb.from('user_blocks').select('blocked_id').eq('blocker_id', userId)
      : Promise.resolve({ data: [] });
    const [hidden, mine, blocks] = await Promise.all([hiddenP, mineP, blocksP]);
    if (hidden.error) throw hidden.error;
    if (mine.error) throw mine.error;
    if (blocks.error) throw blocks.error;
    return {
      hidden:    (hidden.data || []).map(r => (typeof r === 'string' ? r : r.get_hidden_review_keys)),
      myReports: (mine.data || []).map(r => r.review_key),
      blocked:   (blocks.data || []).map(r => r.blocked_id),
    };
  },

  async report(reviewKey, placeId, userId, reason) {
    const { error } = await getSupabase()
      .from('review_reports')
      .insert({ review_key: reviewKey, place_id: String(placeId), reporter_id: userId, reason });
    // 23505 = ya lo había reportado antes → no es error para el usuario
    if (error && error.code !== '23505') throw error;
  },

  async blockUser(userId, blockedId) {
    const { error } = await getSupabase()
      .from('user_blocks')
      .insert({ blocker_id: userId, blocked_id: blockedId });
    if (error && error.code !== '23505') throw error;
  },

  async unblockUser(userId, blockedId) {
    const { error } = await getSupabase()
      .from('user_blocks')
      .delete()
      .eq('blocker_id', userId)
      .eq('blocked_id', blockedId);
    if (error) throw error;
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
