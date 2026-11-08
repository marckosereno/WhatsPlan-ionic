// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — chat/chat-service.js
// Datos del chat de cada plan (32_plan_chat.sql): tus chats, mensajes,
// enviar, marcar leído y tiempo real. Los permisos los pone la base:
// solo los del plan (quien organiza + los que van) leen y escriben.
// (El chat viejo de ActivityModal usa activity_messages; este es aparte.)
// ════════════════════════════════════════════════════════════════════
import { getSupabase } from '/src/services/SupabaseService.js';

const missing = (e) => e && (e.code === 'PGRST202' || e.code === '42P01' || /does not exist|Could not find/.test(e.message || ''));

// [{ activity_id, title, place_id, place_name, scheduled_at, ends_at, stops,
//    participants, creator_id, status, last_body, last_kind, last_user, last_at, unread }]
export async function myChats() {
  const { data, error } = await getSupabase().rpc('my_plan_chats');
  if (error) { if (missing(error)) return []; throw error; }
  return data || [];
}

export async function loadMessages(activityId, limit = 80) {
  const { data, error } = await getSupabase().from('plan_messages').select('*')
    .eq('activity_id', activityId).order('created_at', { ascending: false }).limit(limit);
  if (error) { if (missing(error)) return []; throw error; }
  return (data || []).reverse();
}

// extra: { reply_to, image_path }
export async function sendMessage(activityId, body, kind = 'text', extra = {}) {
  const me = window.wpApp?.currentUser?.id;
  const row = { activity_id: activityId, user_id: me, kind, body };
  if (extra.reply_to) row.reply_to = extra.reply_to;
  if (extra.image_path) row.image_path = extra.image_path;
  const { data, error } = await getSupabase().from('plan_messages').insert(row).select().single();
  if (error) throw error;
  return data;
}

// Reaccionar (la misma otra vez la quita) → reacciones nuevas { user: emoji }
export async function reactMessage(messageId, emoji) {
  const { data, error } = await getSupabase().rpc('react_message', { p_message: messageId, p_emoji: emoji });
  if (error) throw error;
  return data || {};
}

export async function setMuted(activityId, muted) {
  const { error } = await getSupabase().rpc('set_plan_muted', { p_activity: activityId, p_muted: muted });
  if (error) throw error;
}

// Fotos (bucket privado "plan-chat"): subir y pedir ligas firmadas (1 h)
export async function uploadPhoto(activityId, blob) {
  const path = `${activityId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await getSupabase().storage.from('plan-chat').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
  return path;
}

const urls = new Map();
export async function photoUrls(paths) {
  const need = [...new Set(paths)].filter(p => p && !urls.has(p));
  if (need.length) {
    try {
      const { data } = await getSupabase().storage.from('plan-chat').createSignedUrls(need, 3600);
      (data || []).forEach(d => d.signedUrl && urls.set(d.path, d.signedUrl));
    } catch (_) {}
  }
  return urls;
}
export const photoUrl = (path) => urls.get(path) || '';

export async function markRead(activityId) {
  try { await getSupabase().rpc('mark_plan_read', { p_activity: activityId }); } catch (_) {}
}

// Mensajes nuevos de un plan (o de todos los tuyos si no pasas plan).
// Devuelve la función para dejar de escuchar.
// onUpdate(m): cuando cambia un mensaje (reacciones).
export function onMessages(activityId, cb, onUpdate) {
  const sb = getSupabase();
  const opts = { event: 'INSERT', schema: 'public', table: 'plan_messages' };
  if (activityId) opts.filter = `activity_id=eq.${activityId}`;
  let ch = sb.channel(`plan-chat-${activityId || 'all'}-${Math.random().toString(36).slice(2, 7)}`)
    .on('postgres_changes', opts, (p) => p.new && cb(p.new));
  if (onUpdate) ch = ch.on('postgres_changes', { ...opts, event: 'UPDATE' }, (p) => p.new && onUpdate(p.new));
  ch = ch.subscribe();
  return () => { try { sb.removeChannel(ch); } catch (_) {} };
}
