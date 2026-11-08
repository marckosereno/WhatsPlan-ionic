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

export async function sendMessage(activityId, body, kind = 'text') {
  const me = window.wpApp?.currentUser?.id;
  const { data, error } = await getSupabase().from('plan_messages')
    .insert({ activity_id: activityId, user_id: me, kind, body }).select().single();
  if (error) throw error;
  return data;
}

export async function markRead(activityId) {
  try { await getSupabase().rpc('mark_plan_read', { p_activity: activityId }); } catch (_) {}
}

// Mensajes nuevos de un plan (o de todos los tuyos si no pasas plan).
// Devuelve la función para dejar de escuchar.
export function onMessages(activityId, cb) {
  const sb = getSupabase();
  const opts = { event: 'INSERT', schema: 'public', table: 'plan_messages' };
  if (activityId) opts.filter = `activity_id=eq.${activityId}`;
  const ch = sb.channel(`plan-chat-${activityId || 'all'}-${Math.random().toString(36).slice(2, 7)}`)
    .on('postgres_changes', opts, (p) => p.new && cb(p.new))
    .subscribe();
  return () => { try { sb.removeChannel(ch); } catch (_) {} };
}
