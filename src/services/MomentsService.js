// ====================================================================
// WHATSPLAN — MomentsService.js
// Momentos (12 h, tipo stories) y Memories (momentos guardados).
// Tablas: moments, moment_views · Bucket: moments (ver moments.sql)
// ====================================================================
import { getSupabase } from '/src/services/SupabaseService.js';

const BUCKET = 'moments';
const COLS = 'id, user_id, place_id, place_name, lat, lng, photo_path, thumb_path, color, caption, mood, visibility, created_at, expires_at, saved, saved_at, profiles:user_id (name, avatar_url, username)';

// Mensaje claro para los errores de límite que lanza la base de datos
function niceError(e) {
  const m = String(e?.message || e || '');
  if (m.includes('LIMIT_DAY'))   return new Error('Ya compartiste 4 momentos hoy');
  if (m.includes('LIMIT_MONTH')) return new Error('Ya guardaste tus 14 memories de este mes');
  if (m.includes('EXPIRED'))     return new Error('Este momento ya venció');
  if (/bucket not found/i.test(m)) return new Error('Falta crear el bucket "moments" en Supabase (moments_storage.sql)');
  if (/row-level security|unauthorized|403/i.test(m)) return new Error('Supabase no dejó subir la foto: revisa las políticas del bucket "moments"');
  return e instanceof Error ? e : new Error(m);
}

export const MomentsService = {
  BUCKET,
  DAY_LIMIT: 4,
  MONTH_LIMIT: 14,
  HOURS: 12,

  url(path) {
    if (!path) return '';
    return getSupabase().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  },

  // { today, month_saved }
  async quota() {
    const { data, error } = await getSupabase().rpc('moments_quota');
    if (error) throw error;
    const r = Array.isArray(data) ? data[0] : data;
    return { today: r?.today || 0, monthSaved: r?.month_saved || 0 };
  },

  // photo / thumb: Blob webp ya comprimidos (ver MomentsUI._prepare)
  async create({ userId, photo, thumb, color, place, caption, mood, visibility, saveAsMemory }) {
    const sb = getSupabase();
    const id = (crypto.randomUUID && crypto.randomUUID()) ||
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
    const ext = photo.type === 'image/jpeg' ? 'jpg' : 'webp';
    const photoPath = `${userId}/${id}.${ext}`;
    const thumbPath = `${userId}/${id}_t.${ext}`;
    // Archivos con nombre único que nunca cambia → caché de 1 año en el teléfono
    const opts = { contentType: photo.type, cacheControl: '31536000', upsert: false };
    const up1 = await sb.storage.from(BUCKET).upload(photoPath, photo, opts);
    if (up1.error) throw niceError(up1.error);
    const up2 = await sb.storage.from(BUCKET).upload(thumbPath, thumb, { ...opts, contentType: thumb.type });
    if (up2.error) { await sb.storage.from(BUCKET).remove([photoPath]); throw niceError(up2.error); }

    const row = {
      id,
      place_id: place?.id || null,
      place_name: place?.name || null,
      lat: place?.lat ?? null,
      lng: place?.lng ?? null,
      photo_path: photoPath,
      thumb_path: thumbPath,
      color: color || null,
      caption: caption ? caption.slice(0, 140) : null,
      mood: mood || null,
      visibility: visibility || 'followers',
      saved: !!saveAsMemory,
    };
    const { data, error } = await sb.from('moments').insert(row).select(COLS).single();
    if (error) {
      // Si la base de datos lo rechazó (límite), no dejar los archivos huérfanos
      await sb.storage.from(BUCKET).remove([photoPath, thumbPath]);
      throw niceError(error);
    }
    return data;
  },

  // Momentos vivos que puedo ver (los míos + seguidos + públicos)
  async listActive(limit = 200) {
    const { data, error } = await getSupabase()
      .from('moments')
      .select(COLS)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  // Memories (guardadas) de un usuario
  async listMemories(userId, limit = 60) {
    const { data, error } = await getSupabase()
      .from('moments')
      .select(COLS)
      .eq('user_id', userId)
      .eq('saved', true)
      .order('saved_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  // Momentos vivos de un usuario
  async listActiveOf(userId) {
    const { data, error } = await getSupabase()
      .from('moments')
      .select(COLS)
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async saveAsMemory(id) {
    const { data, error } = await getSupabase()
      .from('moments').update({ saved: true }).eq('id', id).select(COLS).single();
    if (error) throw niceError(error);
    return data;
  },

  async unsave(id) {
    const { error } = await getSupabase().from('moments').update({ saved: false }).eq('id', id);
    if (error) throw niceError(error);
  },

  async remove(m) {
    const sb = getSupabase();
    const { error } = await sb.from('moments').delete().eq('id', m.id);
    if (error) throw error;
    await sb.storage.from(BUCKET).remove([m.photo_path, m.thumb_path].filter(Boolean));
  },

  async markViewed(id) {
    try {
      await getSupabase().from('moment_views')
        .upsert({ moment_id: id }, { onConflict: 'moment_id,viewer_id', ignoreDuplicates: true });
    } catch (_) {}
  },

  // Quién vio mi momento → [{ id, name, avatar_url }]
  async viewers(id) {
    const { data, error } = await getSupabase()
      .from('moment_views')
      .select('viewer_id, viewed_at, profiles:viewer_id (id, name, avatar_url)')
      .eq('moment_id', id)
      .order('viewed_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []).map(r => r.profiles).filter(Boolean);
  },

  // Limpieza: mis momentos vencidos y SIN guardar → se borran archivos y
  // fila. Se corre al abrir la app (así no hace falta un servidor).
  async cleanupMine(userId) {
    const sb = getSupabase();
    const { data, error } = await sb.from('moments')
      .select('id, photo_path, thumb_path')
      .eq('user_id', userId).eq('saved', false)
      .lt('expires_at', new Date().toISOString())
      .limit(100);
    if (error || !data?.length) return 0;
    const paths = data.flatMap(m => [m.photo_path, m.thumb_path]).filter(Boolean);
    await sb.storage.from(BUCKET).remove(paths);
    await sb.from('moments').delete().in('id', data.map(m => m.id));
    return data.length;
  },
};
