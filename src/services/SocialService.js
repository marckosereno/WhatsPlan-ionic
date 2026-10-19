// ====================================================================
// WHATSPLAN — SocialService.js
// Perfil: seguidores, conteos, actividades y reseñas de un usuario.
// Tablas: follows (profile_social.sql), profiles, activities, place_reviews
// ====================================================================
import { getSupabase } from '/src/services/SupabaseService.js';

const PROFILE_COLS = 'id, name, avatar_url, username, city, bio';

export const SocialService = {

  async getProfile(userId) {
    const { data, error } = await getSupabase()
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // ¿El @usuario está libre? (sin contar al propio usuario)
  async isUsernameFree(username, myId) {
    const { data, error } = await getSupabase()
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .limit(1);
    if (error) throw error;
    return !(data || []).some(r => r.id !== myId);
  },

  // { followers, following }
  async getFollowCounts(userId) {
    const sb = getSupabase();
    const [a, b] = await Promise.all([
      sb.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
      sb.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId),
    ]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    return { followers: a.count || 0, following: b.count || 0 };
  },

  async isFollowing(myId, userId) {
    const { data, error } = await getSupabase()
      .from('follows')
      .select('following_id')
      .eq('follower_id', myId)
      .eq('following_id', userId)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  },

  async follow(myId, userId, myName = '') {
    const sb = getSupabase();
    const { error } = await sb
      .from('follows')
      .upsert({ follower_id: myId, following_id: userId }, { onConflict: 'follower_id,following_id', ignoreDuplicates: true });
    if (error) throw error;
    // Aviso al seguido (si la tabla lo permite; no es crítico)
    try {
      await sb.from('notifications').insert({
        user_id: userId,
        type: 'follow',
        title: '👋 Nuevo seguidor',
        body: `${myName || 'Alguien'} empezó a seguirte`,
      });
    } catch (_) {}
  },

  async unfollow(myId, userId) {
    const { error } = await getSupabase()
      .from('follows')
      .delete()
      .eq('follower_id', myId)
      .eq('following_id', userId);
    if (error) throw error;
  },

  // Lista de perfiles: 'followers' (lo siguen) o 'following' (a quién sigue)
  async listFollows(userId, kind = 'followers') {
    const sb = getSupabase();
    const isFollowers = kind === 'followers';
    const { data, error } = await sb
      .from('follows')
      .select(isFollowers ? 'follower_id, created_at' : 'following_id, created_at')
      .eq(isFollowers ? 'following_id' : 'follower_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    const ids = (data || []).map(r => isFollowers ? r.follower_id : r.following_id);
    if (!ids.length) return [];
    const { data: profs, error: e2 } = await sb.from('profiles').select(PROFILE_COLS).in('id', ids);
    if (e2) throw e2;
    const byId = new Map((profs || []).map(p => [p.id, p]));
    return ids.map(id => byId.get(id)).filter(Boolean);
  },

  // De esta lista, ¿a quiénes sigo yo? → Set de ids
  async followingSet(myId, ids) {
    if (!myId || !ids.length) return new Set();
    const { data, error } = await getSupabase()
      .from('follows')
      .select('following_id')
      .eq('follower_id', myId)
      .in('following_id', ids);
    if (error) throw error;
    return new Set((data || []).map(r => r.following_id));
  },

  async getReviewCount(userId) {
    const { count, error } = await getSupabase()
      .from('place_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) throw error;
    return count || 0;
  },

  // Actividades próximas que creó o a las que se unió
  async getUserActivities(userId) {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data, error } = await getSupabase()
      .from('activities')
      .select('*, profiles:creator_id (name, avatar_url)')
      .eq('status', 'active')
      .gt('scheduled_at', since)
      .or(`creator_id.eq.${userId},participants.cs.{${userId}}`)
      .order('scheduled_at', { ascending: true })
      .limit(30);
    if (error) throw error;
    return data || [];
  },

  // Usuarios que bloqueé (con su perfil)
  async getBlocked(myId) {
    const sb = getSupabase();
    const { data, error } = await sb.from('user_blocks').select('blocked_id').eq('blocker_id', myId);
    if (error) throw error;
    const ids = (data || []).map(r => r.blocked_id);
    if (!ids.length) return [];
    const { data: profs, error: e2 } = await sb.from('profiles').select(PROFILE_COLS).in('id', ids);
    if (e2) throw e2;
    const byId = new Map((profs || []).map(p => [p.id, p]));
    return ids.map(id => byId.get(id) || { id, name: 'Usuario' });
  },
};
