// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — chat/chat-service.js
// Datos del chat de cada plan (32_plan_chat.sql): tus chats, mensajes,
// enviar, marcar leído y tiempo real. Los permisos los pone la base:
// solo los del plan (quien organiza + los que van) leen y escriben.
// (El chat viejo de ActivityModal usa activity_messages; este es aparte.)
//
// Mensajes directos (35_direct_messages.sql): el mismo chat sirve para
// ellos. Su id va como "dm:<uuid del chat>" y aquí se manda a sus tablas
// (dm_messages, dm_reads) y funciones (dm_react, dm_mark_read…).
// ════════════════════════════════════════════════════════════════════
import { getSupabase } from '/src/services/SupabaseService.js';

// ¿Es un mensaje directo? → [true, uuid] ; si no → [false, id]
export const isDm = (id) => String(id || '').startsWith('dm:');
const route = (id) => isDm(id)
  ? { dm: true, id: String(id).slice(3), table: 'dm_messages', col: 'thread_id' }
  : { dm: false, id, table: 'plan_messages', col: 'activity_id' };

const missing = (e) => e && (e.code === 'PGRST202' || e.code === '42P01' || /does not exist|Could not find/.test(e.message || ''));

// [{ activity_id, title, place_id, place_name, scheduled_at, ends_at, stops,
//    participants, creator_id, status, last_body, last_kind, last_user, last_at, unread }]
export async function myChats() {
  const { data, error } = await getSupabase().rpc('my_plan_chats');
  if (error) { if (missing(error)) return []; throw error; }
  return data || [];
}

// Tus chats directos (con la otra persona) — my_dm_chats
export async function myDmChats() {
  const { data, error } = await getSupabase().rpc('my_dm_chats');
  if (error) { if (missing(error)) return []; throw error; }
  return data || [];
}

// Abrir / crear el chat con alguien → { id, status, requested_by }
export async function openDm(otherId) {
  const { data, error } = await getSupabase().rpc('dm_open', { p_other: otherId });
  if (error) throw error;
  return data;
}

// Aceptar / rechazar una solicitud → 'active' | 'declined'
export async function respondDm(threadId, accept) {
  const { data, error } = await getSupabase().rpc('dm_respond', { p_thread: String(threadId).replace(/^dm:/, ''), p_accept: accept });
  if (error) throw error;
  return data;
}

// after: solo los posteriores (directo que borraste para ti: cleared_at)
export async function loadMessages(activityId, limit = 80, after = null) {
  const r = route(activityId);
  let q = getSupabase().from(r.table).select('*').eq(r.col, r.id);
  if (after) q = q.gt('created_at', after);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
  if (error) { if (missing(error)) return []; throw error; }
  return (data || []).reverse();
}

// extra: { reply_to, image_path }
export async function sendMessage(activityId, body, kind = 'text', extra = {}) {
  const me = window.wpApp?.currentUser?.id, r = route(activityId);
  const row = { [r.col]: r.id, user_id: me, kind, body };
  if (extra.reply_to) row.reply_to = extra.reply_to;
  if (extra.image_path) row.image_path = extra.image_path;
  const { data, error } = await getSupabase().from(r.table).insert(row).select().single();
  if (error) throw error;
  return data;
}

// Reaccionar (la misma otra vez la quita) → reacciones nuevas { user: emoji }
// chatId: el del chat (para saber si es directo)
export async function reactMessage(messageId, emoji, chatId) {
  const { data, error } = await getSupabase().rpc(isDm(chatId) ? 'dm_react' : 'react_message', { p_message: messageId, p_emoji: emoji });
  if (error) throw error;
  return data || {};
}

// ── Acciones de un mensaje (37_chat_actions.sql) ───────────────────
// Borrar: para todos (tuyo, < 1 h) o solo para ti
export async function deleteMessage(messageId, everyone, chatId) {
  const { error } = await getSupabase().rpc('chat_msg_delete', { p_message: messageId, p_everyone: everyone, p_dm: isDm(chatId) });
  if (error) throw error;
}
// Editar (tuyo, < 15 min) → hora de edición
export async function editMessage(messageId, body, chatId) {
  const { data, error } = await getSupabase().rpc('chat_msg_edit', { p_message: messageId, p_body: body, p_dm: isDm(chatId) });
  if (error) throw error;
  return data;
}
// Mensaje fijado de un chat de plan (null = quitar)
export async function pinMessage(activityId, messageId) {
  const { error } = await getSupabase().rpc('plan_chat_pin', { p_activity: activityId, p_message: messageId });
  if (error) throw error;
}
export async function loadPin(activityId) {
  if (isDm(activityId)) return null;
  const { data } = await getSupabase().from('plan_chat_pins').select('message_id').eq('activity_id', activityId).maybeSingle();
  return data?.message_id || null;
}
export function onPin(activityId, cb) {
  if (isDm(activityId)) return () => {};
  const sb = getSupabase();
  const ch = sb.channel(`plan-pin-${activityId}-${Math.random().toString(36).slice(2, 7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_chat_pins', filter: `activity_id=eq.${activityId}` },
      (p) => cb(p.eventType === 'DELETE' ? null : p.new?.message_id || null))
    .subscribe();
  return () => { try { sb.removeChannel(ch); } catch (_) {} };
}

// ── Preferencias de un chat en tu lista ────────────────────────────
// o: { pin, hide, unread, clear } (cada uno true/false; lo que no pases no cambia)
export async function chatPref(chatId, o = {}) {
  const { error } = await getSupabase().rpc('chat_pref', { p_chat: String(chatId), p_pin: o.pin ?? null, p_hide: o.hide ?? null,
    p_unread: o.unread ?? null, p_clear: o.clear ?? null });
  if (error) throw error;
}

export async function setMuted(activityId, muted) {
  const r = route(activityId);
  const { error } = r.dm
    ? await getSupabase().rpc('dm_set_muted', { p_thread: r.id, p_muted: muted })
    : await getSupabase().rpc('set_plan_muted', { p_activity: activityId, p_muted: muted });
  if (error) throw error;
}

// Fotos (bucket privado "plan-chat"): subir y pedir ligas firmadas (1 h)
export async function uploadPhoto(activityId, blob) {
  const r = route(activityId);
  const path = `${r.dm ? `dm/${r.id}` : activityId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
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
  const r = route(activityId);
  try {
    if (r.dm) await getSupabase().rpc('dm_mark_read', { p_thread: r.id });
    else await getSupabase().rpc('mark_plan_read', { p_activity: activityId });
  } catch (_) {}
}

// Mensajes nuevos de un plan (o de todos los tuyos si no pasas plan).
// "dm:" a secas = todos tus mensajes directos; "dm:<uuid>" = ese chat.
// Devuelve la función para dejar de escuchar.
// onUpdate(m): cuando cambia un mensaje (reacciones).
// onStatus(s): estado del canal ('SUBSCRIBED', 'CHANNEL_ERROR'…), para live.js
export function onMessages(activityId, cb, onUpdate, onStatus) {
  const sb = getSupabase();
  const r = route(activityId);
  const opts = { event: 'INSERT', schema: 'public', table: r.table };
  if (r.id) opts.filter = `${r.col}=eq.${r.id}`;
  let ch = sb.channel(`${r.dm ? 'dm' : 'plan'}-chat-${r.id || 'all'}-${Math.random().toString(36).slice(2, 7)}`)
    .on('postgres_changes', opts, (p) => p.new && cb(p.new));
  if (onUpdate) ch = ch.on('postgres_changes', { ...opts, event: 'UPDATE' }, (p) => p.new && onUpdate(p.new));
  ch = ch.subscribe((status) => onStatus?.(status));
  return () => { try { sb.removeChannel(ch); } catch (_) {} };
}
